import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { createNotification } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = authContext.user.id;
  const body = await request.json().catch(() => ({}));
  const collectionId = typeof body.collection_id === 'string' ? body.collection_id : null;
  if (collectionId) {
    const { data: collection, error: collectionError } = await supabaseServer
      .from('wpx_favorite_collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (collectionError) return NextResponse.json({ error: collectionError.message }, { status: 500 });
    if (!collection) return NextResponse.json({ error: 'Favorite collection not found.' }, { status: 404 });
  }
  const { data: existing, error: existingError } = await supabaseServer.from('wpx_post_favorites').select('*').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  if (existing) {
    const { error: delError } = await supabaseServer.from('wpx_post_favorites').delete().eq('post_id', postId).eq('user_id', userId);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
  } else {
    const { error: insError } = await supabaseServer.from('wpx_post_favorites').insert({ post_id: postId, user_id: userId, collection_id: collectionId });
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
    try {
      const { data: postData } = await supabaseServer.from('wpx_posts').select('author_id').eq('id', postId).maybeSingle();
      const authorId = postData?.author_id;
      if (authorId && authorId !== userId) {
        await createNotification({
          userId: authorId,
          actorId: userId,
          type: 'favorite',
          resourceType: 'post',
          resourceId: postId,
          metadata: { post_id: postId },
          push: { title: 'Post saved', body: 'Someone favorited your post.', url: `/post/${postId}`, tag: `favorite-${postId}` }
        });
      }
    } catch {
      // ignore
    }
  }

  const { data: favorites } = await supabaseServer.from('wpx_post_favorites').select('*').eq('post_id', postId);
  const count = (favorites || []).length;
  return NextResponse.json({ favorited: !existing, count });
}
