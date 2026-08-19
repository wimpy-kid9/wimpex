import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { createNotification } from '@/lib/notifications';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: comments, error } = await supabaseServer.from('wpx_post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const authorIds = Array.from(new Set((comments || []).map((comment: any) => comment.author_id).filter(Boolean)));
  const authorMap: Record<string, any> = {};

  if (authorIds.length > 0) {
    const { data: profiles, error: profileError } = await supabaseServer
      .from('wpx_profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', authorIds);

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    (profiles || []).forEach((profile: any) => {
      if (profile?.user_id) authorMap[profile.user_id] = profile;
    });
  }

  return NextResponse.json({
    comments: (comments || []).map((comment: any) => ({
      ...comment,
      author: authorMap[comment.author_id]?.display_name || authorMap[comment.author_id]?.username || null,
      author_handle: authorMap[comment.author_id]?.username ? `@${authorMap[comment.author_id]?.username}` : null,
      author_avatar_url: authorMap[comment.author_id]?.avatar_url || null
    }))
  });
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

  const parentCommentId = body.parent_comment_id || null;
  const { data: inserted, error } = await supabaseServer.from('wpx_post_comments').insert({ post_id: postId, author_id: authContext.user.id, body: body.body.trim(), parent_comment_id: parentCommentId }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // notify post author
  try {
    const { data: postData } = await supabaseServer.from('wpx_posts').select('author_id').eq('id', postId).maybeSingle();
    const authorId = postData?.author_id;
    if (authorId && authorId !== authContext.user.id) {
      await createNotification({
        userId: authorId,
        actorId: authContext.user.id,
        type: 'comment',
        resourceType: 'post',
        resourceId: postId,
        metadata: { post_id: postId, comment_id: inserted.id },
        push: { title: 'New comment', body: 'Someone commented on your post.', url: `/post/${postId}`, tag: `comment-${postId}` }
      });
    }
  } catch {
    // ignore
  }
  return NextResponse.json({ comment: inserted });
}
