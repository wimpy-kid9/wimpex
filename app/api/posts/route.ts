import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { calculateDailyPostStreakState } from '@/lib/streak-utils';
import { isGoldSubscription } from '@/lib/subscription';

const VIDEO_BUCKET = 'wpx-videos';
const IMAGE_BUCKET = 'wpx-images';

function mapPost(post: any, likeCounts: Record<string, number>, favoriteCounts: Record<string, number>, authorMap: Record<string, any>) {
  const author = authorMap[post.author_id] || {};

  return {
    id: post.id,
    author_id: post.author_id,
    author: author.display_name || post.author_display_name || 'WIMPEX user',
    handle: author.username ? `@${author.username}` : post.author_handle || '@wimpex',
    avatar_url: author.avatar_url || null,
    caption: post.caption || '',
    visibility: post.visibility || 'public',
    createdAt: post.created_at,
    accent: post.accent || 'from-gold to-gold-deep',
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
    like_count: likeCounts[post.id] ?? 0,
    favorite_count: favoriteCounts[post.id] ?? 0,
    share_count: post.share_count ?? 0,
    status: post.status || 'published'
  };
}

async function loadAuthors(authorIds: string[]) {
  if (authorIds.length === 0) return {};

  const { data: authors, error: authorError } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, display_name, username, avatar_url')
    .in('user_id', authorIds);

  if (authorError) {
    return {};
  }

  return (authors || []).reduce((acc: Record<string, any>, author: any) => {
    if (author?.user_id) acc[author.user_id] = author;
    return acc;
  }, {} as Record<string, any>);
}

async function loadCounts(postIds: string[]) {
  if (postIds.length === 0) return { likeCounts: {}, favoriteCounts: {} };

  const [{ data: likes }, { data: favorites }] = await Promise.all([
    supabaseServer.from('wpx_post_likes').select('post_id'),
    supabaseServer.from('wpx_post_favorites').select('post_id')
  ]);

  const likeCounts: Record<string, number> = {};
  const favoriteCounts: Record<string, number> = {};

  (likes || []).forEach((row: any) => {
    likeCounts[row.post_id] = (likeCounts[row.post_id] || 0) + 1;
  });
  (favorites || []).forEach((row: any) => {
    favoriteCounts[row.post_id] = (favoriteCounts[row.post_id] || 0) + 1;
  });

  return { likeCounts, favoriteCounts };
}

async function getActiveSubscription(userId: string) {
  const { data } = await supabaseServer
    .from('wpx_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('active_until', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function updateDailyPostStreak(userId: string, publishedAt: string) {
  const { data: existingStreak, error: streakError } = await supabaseServer
    .from('wpx_streaks')
    .select('*')
    .eq('user_id', userId)
    .eq('streak_type', 'daily_post')
    .maybeSingle();

  if (streakError) {
    throw new Error(streakError.message);
  }

  const subscription = await getActiveSubscription(userId);
  const nextState = calculateDailyPostStreakState(existingStreak, publishedAt, { isGold: isGoldSubscription(subscription) });

  if (!existingStreak) {
    const { data, error } = await supabaseServer.from('wpx_streaks').insert({
      user_id: userId,
      streak_type: 'daily_post',
      ...nextState
    }).select().maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  const { data, error } = await supabaseServer.from('wpx_streaks').update({
    ...nextState
  }).eq('id', existingStreak.id).select().maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ posts: [] });
  }

  const authorId = request.nextUrl.searchParams.get('author_id');
  const type = request.nextUrl.searchParams.get('type');
  const currentOnly = request.nextUrl.searchParams.get('current_only') === 'true';

  let authContext: any = null;
  if (type === 'liked' || type === 'favorited' || type === 'drafts' || currentOnly) {
    try {
      authContext = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const query = supabaseServer.from('wpx_posts').select(
    `id, author_id, visibility, caption, media_type, video_url, image_url, thumbnail_url, audio_track_id, audio_track_name, audio_artist_name, audio_preview_url, audio_cover_art_url, filter_preset, share_count, created_at, status`
  );

  let rows: any[] = [];

  if (type === 'liked') {
    const userId = authorId || authContext.user.id;
    if (userId !== authContext.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: likedPosts, error: likedError } = await supabaseServer
      .from('wpx_post_likes')
      .select('post_id')
      .eq('user_id', userId);

    if (likedError) {
      return NextResponse.json({ error: likedError.message }, { status: 500 });
    }

    const postIds = (likedPosts || []).map((row: any) => row.post_id);
    if (postIds.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    const { data, error } = await query.in('id', postIds).order('created_at', { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = data || [];
  } else if (type === 'favorited') {
    const userId = authorId || authContext.user.id;
    if (userId !== authContext.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: favoritedPosts, error: favoriteError } = await supabaseServer
      .from('wpx_post_favorites')
      .select('post_id')
      .eq('user_id', userId);

    if (favoriteError) {
      return NextResponse.json({ error: favoriteError.message }, { status: 500 });
    }

    const postIds = (favoritedPosts || []).map((row: any) => row.post_id);
    if (postIds.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    const { data, error } = await query.in('id', postIds).order('created_at', { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = data || [];
  } else if (type === 'drafts') {
    const userId = authorId || authContext.user.id;
    if (userId !== authContext.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await query.eq('author_id', userId).eq('status', 'draft').order('created_at', { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = data || [];
  } else if (authorId) {
    if (authorId === authContext?.user?.id) {
      const { data, error } = await query.eq('author_id', authorId).order('created_at', { ascending: false });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rows = data || [];
    } else {
      const { data, error } = await query
        .eq('author_id', authorId)
        .eq('visibility', 'public')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rows = data || [];
    }
  } else {
    const { data, error } = await query.eq('visibility', 'public').eq('status', 'published').order('created_at', { ascending: false }).limit(20);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rows = data || [];
  }

  const postIds = rows.map((post) => post.id);
  const authorIds = Array.from(new Set(rows.map((post) => post.author_id).filter(Boolean)));
  const authorMap = await loadAuthors(authorIds);
  const { likeCounts, favoriteCounts } = await loadCounts(postIds);

  return NextResponse.json({
    posts: rows.map((post) => mapPost(post, likeCounts, favoriteCounts, authorMap))
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ post: null });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let caption = '';
  let visibility: string = 'public';
  let status: string = 'published';
  let videoUrl = '';
  let imageUrl = '';
  let thumbnailUrl = '';
  let mediaType = 'video';
  let audioTrackId = '';
  let audioTrackName = '';
  let audioArtistName = '';
  let audioPreviewUrl = '';
  let audioCoverArtUrl = '';
  let filterPreset = 'none';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    caption = formData.get('caption')?.toString() || '';
    visibility = formData.get('visibility')?.toString() || 'public';
    status = formData.get('status')?.toString() || 'published';
    thumbnailUrl = formData.get('thumbnail_url')?.toString() || '';
    mediaType = formData.get('media_type')?.toString() || 'video';
    filterPreset = formData.get('filter_preset')?.toString() || 'none';
    audioTrackId = formData.get('audio_track_id')?.toString() || '';
    audioTrackName = formData.get('audio_track_name')?.toString() || '';
    audioArtistName = formData.get('audio_artist_name')?.toString() || '';
    audioPreviewUrl = formData.get('audio_preview_url')?.toString() || '';
    audioCoverArtUrl = formData.get('audio_cover_art_url')?.toString() || '';

    const videoFile = formData.get('video');
    const imageFile = formData.get('image');

    if (videoFile && imageFile) {
      return NextResponse.json({ error: 'Please upload either a video or an image, not both.' }, { status: 400 });
    }

    const uploadFile = videoFile || imageFile;
    if (uploadFile && typeof uploadFile !== 'string' && 'arrayBuffer' in uploadFile) {
      const file = uploadFile as File;
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        return NextResponse.json({ error: 'Unsupported media type. Upload an image or video.' }, { status: 400 });
      }

      const bucket = isImage ? IMAGE_BUCKET : VIDEO_BUCKET;
      const pathPrefix = isImage ? 'images' : 'videos';
      const allowedMimeTypes = isImage
        ? ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
        : ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/ogg'];

      try {
        await supabaseServer.storage.createBucket(bucket, {
          public: true,
          allowedMimeTypes,
          fileSizeLimit: '104857600'
        });
      } catch {
        // ignore bucket-create failures
      }

      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { data: uploadData, error: uploadError } = await supabaseServer.storage.from(bucket).upload(`${pathPrefix}/${authContext.user.id}/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || (isImage ? 'image/png' : 'video/mp4')
      });
      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      const { data: publicUrlData } = supabaseServer.storage.from(bucket).getPublicUrl(uploadData?.path || fileName);
      if (isImage) {
        imageUrl = publicUrlData?.publicUrl || '';
        mediaType = 'image';
      } else {
        videoUrl = publicUrlData?.publicUrl || '';
        mediaType = 'video';
      }
    }
  } else {
    const body = await request.json();
    caption = body.caption || '';
    visibility = body.visibility || 'public';
    status = body.status || 'published';
    videoUrl = body.video_url || '';
    imageUrl = body.image_url || '';
    thumbnailUrl = body.thumbnail_url || '';
    mediaType = body.media_type || (body.image_url ? 'image' : 'video');
    filterPreset = body.filter_preset || 'none';
    audioTrackId = body.audio_track_id || '';
    audioTrackName = body.audio_track_name || '';
    audioArtistName = body.audio_artist_name || '';
    audioPreviewUrl = body.audio_preview_url || '';
    audioCoverArtUrl = body.audio_cover_art_url || '';
  }

  if (!imageUrl && !videoUrl && status !== 'draft') {
    return NextResponse.json({ error: 'Please upload an image or video.' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('wpx_posts')
    .insert({
      author_id: authContext.user.id,
      caption,
      visibility,
      status: status === 'draft' ? 'draft' : 'published',
      media_type: mediaType,
      video_url: videoUrl || null,
      image_url: imageUrl || null,
      thumbnail_url: thumbnailUrl || null,
      audio_track_id: audioTrackId || null,
      audio_track_name: audioTrackName || null,
      audio_artist_name: audioArtistName || null,
      audio_preview_url: audioPreviewUrl || null,
      audio_cover_art_url: audioCoverArtUrl || null,
      filter_preset: filterPreset || null
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let streakData = null;
  try {
    if (data.status === 'published') {
      streakData = await updateDailyPostStreak(authContext.user.id, data.created_at);
    }
  } catch {
    // ignore streak update failures for now
  }

  const authorMap = await loadAuthors([authContext.user.id]);
  const enrichedAuthor = authorMap[authContext.user.id] || {};

  return NextResponse.json({
    post: {
      id: data.id,
      author: enrichedAuthor.display_name || 'WIMPEX user',
      handle: enrichedAuthor.username ? `@${enrichedAuthor.username}` : '@wimpex',
      avatar_url: enrichedAuthor.avatar_url || null,
      caption: data.caption || '',
      visibility: data.visibility || 'public',
      createdAt: data.created_at,
      accent: 'from-gold to-gold-deep',
      mediaType: data.media_type || 'video',
      videoUrl: data.video_url || null,
      imageUrl: data.image_url || null,
      thumbnailUrl: data.thumbnail_url || null,
      audioTrackId: data.audio_track_id || null,
      audioTrackName: data.audio_track_name || null,
      audioArtistName: data.audio_artist_name || null,
      audioPreviewUrl: data.audio_preview_url || null,
      audioCoverArtUrl: data.audio_cover_art_url || null,
      filterPreset: data.filter_preset || 'none',
      status: data.status || 'published'
    },
    streak: streakData
  });
}
