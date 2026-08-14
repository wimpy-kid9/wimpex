import { supabaseServer } from '@/lib/supabase-server';

// #tag — letters, numbers, underscore, matching the same shape hashtags
// take everywhere else in the product (search, hashtag pages).
const HASHTAG_PATTERN = /#([a-z0-9_]+)/gi;

// @handle — usernames are 3–20 letters/numbers/underscores (see
// usernamePattern in app/api/profile/route.ts), so mentions follow the
// same shape.
const MENTION_PATTERN = /@([a-z0-9_]{3,20})/gi;

export function extractHashtags(caption: string): string[] {
  const matches = caption.match(HASHTAG_PATTERN) || [];
  const unique = new Set(matches.map((m) => m.slice(1).toLowerCase()));
  return Array.from(unique);
}

export function extractMentionHandles(caption: string): string[] {
  const matches = caption.match(MENTION_PATTERN) || [];
  const unique = new Set(matches.map((m) => m.slice(1).toLowerCase()));
  return Array.from(unique);
}

/**
 * Extracts #hashtags and @mentions from a post's caption and replaces
 * that post's rows in wpx_post_hashtags / wpx_post_user_tags to match.
 * Previously nothing in the app ever wrote to either table, so hashtag
 * search, hashtag-based FYP affinity, and user tagging all silently did
 * nothing even though the tables, indexes, and read paths for them
 * already existed. Call this after any insert/update that changes a
 * post's caption.
 */
export async function syncPostHashtagsAndMentions(postId: string, caption: string) {
  const hashtags = extractHashtags(caption);
  const mentionHandles = extractMentionHandles(caption);

  await Promise.all([
    supabaseServer.from('wpx_post_hashtags').delete().eq('post_id', postId),
    supabaseServer.from('wpx_post_user_tags').delete().eq('post_id', postId)
  ]);

  if (hashtags.length > 0) {
    await supabaseServer.from('wpx_post_hashtags').insert(hashtags.map((tag) => ({ post_id: postId, tag })));
  }

  if (mentionHandles.length > 0) {
    // Usernames keep their original casing (only trimmed + pattern-checked
    // on save), so match mentions case-insensitively.
    const orFilter = mentionHandles.map((handle) => `username.ilike.${handle}`).join(',');
    const { data: mentionedProfiles } = await supabaseServer
      .from('wpx_profiles')
      .select('user_id')
      .or(orFilter);

    const taggedUserIds = Array.from(new Set((mentionedProfiles || []).map((p: any) => p.user_id).filter(Boolean)));
    if (taggedUserIds.length > 0) {
      await supabaseServer
        .from('wpx_post_user_tags')
        .insert(taggedUserIds.map((tagged_user_id) => ({ post_id: postId, tagged_user_id })));
    }
  }
}
