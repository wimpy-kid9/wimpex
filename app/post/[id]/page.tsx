import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import PostDetailClient from '@/app/post/PostDetailClient';

interface Props {
  params: { id: string };
}

export default async function PostPage({ params }: Props) {
  const { id } = params;

  if (!id) {
    notFound();
  }

  const { data: post, error } = await supabaseServer.from('wpx_posts').select('*').eq('id', id).maybeSingle();
  if (error || !post) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-semibold">Post</h1>
        <p className="mt-2 text-slate">Unable to load post.</p>
      </main>
    );
  }

  let author: { display_name?: string | null; username?: string | null; avatar_url?: string | null } | null = null;
  if (post.author_id) {
    const { data: profile } = await supabaseServer
      .from('wpx_profiles')
      .select('display_name, username, avatar_url')
      .eq('user_id', post.author_id)
      .maybeSingle();
    author = profile;
  }

  const [{ count: likeCount }, { count: favoriteCount }] = await Promise.all([
    supabaseServer.from('wpx_post_likes').select('id', { count: 'exact', head: true }).eq('post_id', id),
    supabaseServer.from('wpx_post_favorites').select('id', { count: 'exact', head: true }).eq('post_id', id)
  ]);

  // PostCard (shared with the feed) expects camelCase fields — mediaType,
  // videoUrl, imageUrl, etc. — matching the shape /api/posts' mapPost()
  // produces everywhere else in the app. This page previously spread the
  // raw database row (`...post`) straight into the component, which is
  // snake_case (media_type, video_url, image_url). Since none of those
  // camelCase fields existed, PostCard's `post.mediaType === 'video' &&
  // post.videoUrl` check never matched, so the page rendered with no
  // video or image at all — which is why tapping a video from the Liked
  // tab landed on a blank post instead of the actual video.
  const enrichedPost = {
    id: post.id,
    author_id: post.author_id,
    author: author?.display_name || post.author_display_name || 'WIMPEX user',
    handle: author?.username ? `@${author.username}` : post.author_handle || '@wimpex',
    avatar_url: author?.avatar_url || null,
    is_gold: false,
    caption: post.caption || '',
    createdAt: post.created_at,
    mediaType: post.media_type || 'video',
    videoUrl: post.video_url || null,
    imageUrl: post.image_url || null,
    thumbnailUrl: post.thumbnail_url || null,
    audioTrackId: post.audio_track_id || null,
    audioTrackName: post.audio_track_name || null,
    audioArtistName: post.audio_artist_name || null,
    audioPreviewUrl: post.audio_preview_url || null,
    audioCoverArtUrl: post.audio_cover_art_url || null,
    filterPreset: post.filter_preset || 'none',
    like_count: likeCount ?? 0,
    favorite_count: favoriteCount ?? 0,
    share_count: post.share_count ?? 0,
    status: post.status || 'published'
  };

  return (
    <main className="h-[100dvh] w-full overflow-hidden">
      <PostDetailClient post={enrichedPost} />
    </main>
  );
}