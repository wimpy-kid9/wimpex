import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServerConfigured, supabaseServer } from '../../../lib/supabase-server';

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ posts: [] });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { data, error } = await supabaseServer
    .from('wpx_posts')
    .select('id, author_id, caption, visibility, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    posts: (data || []).map((post: any) => ({
      id: post.id,
      author: 'WIMPEX user',
      handle: '@wimpex',
      caption: post.caption || '',
      visibility: post.visibility || 'public',
      createdAt: post.created_at,
      accent: 'from-fuchsia-500 to-cyan-500'
    }))
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ post: null });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const {
    data: { user },
    error: userError
  } = await supabaseServer.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: userError?.message || 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { caption, visibility = 'public' } = body;

  const { data, error } = await supabaseServer
    .from('wpx_posts')
    .insert({
      author_id: user.id,
      caption,
      visibility,
      video_url: 'https://example.com/placeholder.mp4'
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
      accent: 'from-fuchsia-500 to-cyan-500'
    }
  });
}
