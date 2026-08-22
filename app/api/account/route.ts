import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

// Deletes/anonymizes everything WIMPEX itself owns for this user.
//
// IMPORTANT: this does NOT delete the Supabase auth.users row. That row
// is the shared WimpyID identity — the same auth.users table backs
// WimpyID, WimpyPay, and every other Wimpy Cooperations product on this
// project (see BUILD_PROMPT.md §2). Deleting it here would delete the
// person's WimpyID account and break their access to those other
// products, which is out of scope for WIMPEX to do unilaterally.
//
// Full WimpyID account deletion has to happen at id.wimpy-corp.com.ng.
// This endpoint removes WIMPEX's footprint only: profile, posts,
// messages content, connections, calls, etc. Moderation reports
// (wpx_reports) and billing records (wpx_subscriptions) are kept for
// legal/trust-and-safety reasons — adjust if that's not the policy you want.
export async function DELETE(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Confirmation required.' }, { status: 400 });
  }

  const userId = authContext.user.id;
  const errors: string[] = [];
  const run = async (label: string, fn: () => Promise<{ error: any }>) => {
    const { error } = await fn();
    if (error) errors.push(`${label}: ${error.message}`);
  };

  // --- Leaf tables: device/push/call plumbing ---
  await run('device_push_tokens', () =>
    supabaseServer.from('wpx_device_push_tokens').delete().eq('user_id', userId));
  await run('push_subscriptions', () =>
    supabaseServer.from('wpx_push_subscriptions').delete().eq('user_id', userId));
  await run('call_ice_candidates', () =>
    supabaseServer.from('wpx_call_ice_candidates').delete()
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`));
  await run('call_signals', () =>
    supabaseServer.from('wpx_call_signals').delete().eq('sender_id', userId));
  await run('calls', () =>
    supabaseServer.from('wpx_calls').delete()
      .or(`caller_id.eq.${userId},callee_id.eq.${userId}`));
  await run('ai_daily_usage', () =>
    supabaseServer.from('wpx_ai_daily_usage').delete().eq('user_id', userId));
  await run('profile_views', () =>
    supabaseServer.from('wpx_profile_views').delete()
      .or(`profile_user_id.eq.${userId},viewer_user_id.eq.${userId}`));
  await run('streaks', () =>
    supabaseServer.from('wpx_streaks').delete().eq('user_id', userId));

  // --- Reading rooms: delete ones they created (cascades participants/
  // highlights/messages/recaps for those rooms), then their own footprint
  // in rooms they didn't create ---
  await run('reading_rooms_owned', () =>
    supabaseServer.from('wpx_reading_rooms').delete().eq('creator_id', userId));
  await run('room_participants', () =>
    supabaseServer.from('wpx_room_participants').delete().eq('user_id', userId));
  await run('room_highlights', () =>
    supabaseServer.from('wpx_room_highlights').delete().eq('user_id', userId));
  await run('room_messages', () =>
    supabaseServer.from('wpx_room_messages').delete().eq('sender_id', userId));

  // --- Engagement / tagging ---
  await run('post_user_tags', () =>
    supabaseServer.from('wpx_post_user_tags').delete().eq('tagged_user_id', userId));
  await run('user_post_interactions', () =>
    supabaseServer.from('wpx_user_post_interactions').delete().eq('user_id', userId));
  await run('message_reactions', () =>
    supabaseServer.from('wpx_message_reactions').delete().eq('user_id', userId));

  // --- Messages: scrub content on messages they sent, same shape as the
  // existing "unsend" feature, so the other party's conversation still
  // makes sense but nothing readable of theirs remains. Then drop their
  // membership row. ---
  await run('messages_content', () =>
    supabaseServer.from('wpx_messages')
      .update({ body: null, media_url: null, unsent_at: new Date().toISOString() })
      .eq('sender_id', userId));
  await run('conversation_members', () =>
    supabaseServer.from('wpx_conversation_members').delete().eq('user_id', userId));

  // --- Social graph ---
  await run('connections', () =>
    supabaseServer.from('wpx_connections').delete()
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`));
  await run('follows', () =>
    supabaseServer.from('wpx_follows').delete()
      .or(`follower_id.eq.${userId},followed_id.eq.${userId}`));
  await run('blocks', () =>
    supabaseServer.from('wpx_blocks').delete()
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`));

  // --- Notifications: delete their own inbox, scrub them out as an actor
  // in other people's notifications ---
  await run('notifications_own', () =>
    supabaseServer.from('wpx_notifications').delete().eq('user_id', userId));
  await run('notifications_actor', () =>
    supabaseServer.from('wpx_notifications').update({ actor_id: null }).eq('actor_id', userId));

  // --- Posts + engagement on them ---
  await run('post_likes', () =>
    supabaseServer.from('wpx_post_likes').delete().eq('user_id', userId));
  await run('post_comments', () =>
    supabaseServer.from('wpx_post_comments').delete().eq('author_id', userId));
  await run('post_favorites', () =>
    supabaseServer.from('wpx_post_favorites').delete().eq('user_id', userId));
  await run('posts', () =>
    supabaseServer.from('wpx_posts').delete().eq('author_id', userId));

  // --- Storage: avatars/videos/images/chat media are all stored under a
  // `${userId}/...` folder per bucket (see upload-avatar, posts, messages
  // routes) ---
  for (const bucket of ['wpx-avatars', 'wpx-videos', 'wpx-images', 'wpx-chat-media']) {
    const { data: files } = await supabaseServer.storage.from(bucket).list(userId);
    if (files?.length) {
      await run(`storage:${bucket}`, () =>
       supabaseServer.storage.from(bucket).remove(files.map((f: { name: string }) => `${userId}/${f.name}`)));
    }
  }

  // --- Settings + profile last ---
  await run('privacy_settings', () =>
    supabaseServer.from('wpx_privacy_settings').delete().eq('user_id', userId));
  await run('profile', () =>
    supabaseServer.from('wpx_profiles').delete().eq('user_id', userId));

  if (errors.length) {
    // Best-effort deletion: report what failed so it can be retried/cleaned
    // up, but don't claim total success.
    return NextResponse.json({ deleted: true, partial: true, errors }, { status: 207 });
  }

  return NextResponse.json({ deleted: true });
}
