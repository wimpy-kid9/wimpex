import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

const VIDEO_BUCKET = 'wpx-videos';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ posts: [] });
  }

  const { data, error } = await supabaseServer
    .from('wpx_posts')
    .select('id, author_id, caption, visibility, created_at, video_url, thumbnail_url')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    posts: (data || []).map((post: any) => ({
      id: post.id,
      author_id: post.author_id,
      author: 'WIMPEX user',
      handle: '@wimpex',
      caption: post.caption || '',
      visibility: post.visibility || 'public',
      createdAt: post.created_at,
      accent: 'from-fuchsia-500 to-cyan-500',
      videoUrl: post.video_url || null,
      thumbnailUrl: post.thumbnail_url || null
    }))
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ post: null });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let caption = '';
  let visibility: string = 'public';
  let videoUrl = '';
  let thumbnailUrl = '';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    caption = formData.get('caption')?.toString() || '';
    visibility = formData.get('visibility')?.toString() || 'public';
    thumbnailUrl = formData.get('thumbnail_url')?.toString() || '';

    const videoFile = formData.get('video');
    if (videoFile && typeof videoFile !== 'string' && 'arrayBuffer' in videoFile) {
      try {
        await supabaseServer.storage.createBucket(VIDEO_BUCKET, {
          public: true,
          allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/ogg'],
          fileSizeLimit: '104857600'
        });
      } catch {
        // Ignore bucket-create failures if the bucket already exists or the environment does not permit it.
      }

      const fileName = `${Date.now()}-${(videoFile as File).name.replace(/\s+/g, '-')}`;
      const { data: uploadData, error: uploadError } = await supabaseServer.storage.from(VIDEO_BUCKET).upload(`videos/${authContext.user.id}/${fileName}`, videoFile as File, {
        cacheControl: '3600',
        upsert: false,
        contentType: (videoFile as File).type || 'video/mp4'
      });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      const { data: publicUrlData } = supabaseServer.storage.from(VIDEO_BUCKET).getPublicUrl(uploadData?.path || fileName);
      videoUrl = publicUrlData?.publicUrl || '';
    }
  } else {
    const body = await request.json();
    caption = body.caption || '';
    visibility = body.visibility || 'public';
    videoUrl = body.video_url || '';
    thumbnailUrl = body.thumbnail_url || '';
  }

  const { data, error } = await supabaseServer
    .from('wpx_posts')
    .insert({
      author_id: authContext.user.id,
      caption,
      visibility,
      video_url: videoUrl || 'https://example.com/placeholder.mp4',
      thumbnail_url: thumbnailUrl || null
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    post: {
      id: data.id,
      author: 'WIMPEX user',
      handle: '@wimpex',
      caption: data.caption || '',
      visibility: data.visibility || 'public',
      createdAt: data.created_at,
      accent: 'from-fuchsia-500 to-cyan-500',
      videoUrl: data.video_url || null,
      thumbnailUrl: data.thumbnail_url || null
    }
  });
}
