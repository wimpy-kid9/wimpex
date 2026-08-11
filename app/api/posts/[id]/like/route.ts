import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = authContext.user.id;

  const { data: existing, error: existingError } = await supabaseServer.from('wpx_post_likes').select('*').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  if (existing) {
    const { error: delError } = await supabaseServer.from('wpx_post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
  } else {
    const { error: insError } = await supabaseServer.from('wpx_post_likes').insert({ post_id: postId, user_id: userId });
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
    // insert notification for post author
    try {
      const { data: postData } = await supabaseServer.from('wpx_posts').select('author_id').eq('id', postId).maybeSingle();
      const authorId = postData?.author_id;
      if (authorId && authorId !== userId) {
        await supabaseServer.from('wpx_notifications').insert({ user_id: authorId, type: 'like', metadata: { post_id: postId, actor_id: userId } });
      }
    } catch {
      // ignore notification errors
    }
  }

  const { data: likes } = await supabaseServer.from('wpx_post_likes').select('*').eq('post_id', postId);
  const count = (likes || []).length;
  return NextResponse.json({ liked: !existing, count });
}
