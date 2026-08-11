import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseServer.from('wpx_post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.body?.trim()) return NextResponse.json({ error: 'Comment body required.' }, { status: 400 });

  const { data: inserted, error } = await supabaseServer.from('wpx_post_comments').insert({ post_id: postId, author_id: authContext.user.id, body: body.body.trim() }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // notify post author
  try {
    const { data: postData } = await supabaseServer.from('wpx_posts').select('author_id').eq('id', postId).maybeSingle();
    const authorId = postData?.author_id;
    if (authorId && authorId !== authContext.user.id) {
      await supabaseServer.from('wpx_notifications').insert({ user_id: authorId, type: 'comment', metadata: { post_id: postId, actor_id: authContext.user.id, comment_id: inserted.id } });
    }
  } catch {
    // ignore
  }
  return NextResponse.json({ comment: inserted });
}
