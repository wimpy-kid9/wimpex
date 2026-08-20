import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isUserGold(authContext.user.id))) {
    return NextResponse.json({ error: 'Gold membership is required for post analytics.' }, { status: 403 });
  }

  const { data: post, error: postError } = await supabaseServer
    .from('wpx_posts')
    .select('id, author_id, caption, created_at')
    .eq('id', params.id)
    .maybeSingle();
  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  if (post.author_id !== authContext.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ data: interactions, error: interactionError }, { count: likes, error: likesError }] = await Promise.all([
    supabaseServer.from('wpx_user_post_interactions').select('interaction_type, watch_ms').eq('post_id', params.id),
    supabaseServer.from('wpx_post_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', params.id)
  ]);
  if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 500 });
  if (likesError) return NextResponse.json({ error: likesError.message }, { status: 500 });

  const rows = interactions || [];
  const views = rows.filter((row: any) => row.interaction_type === 'view' || row.interaction_type === 'watch_complete').length;
  const watchValues = rows.map((row: any) => Number(row.watch_ms)).filter((value: number) => Number.isFinite(value) && value >= 0);
  const shares = rows.filter((row: any) => row.interaction_type === 'share').length;

  return NextResponse.json({
    post,
    analytics: {
      views,
      averageWatchMs: watchValues.length ? Math.round(watchValues.reduce((sum: number, value: number) => sum + value, 0) / watchValues.length) : 0,
      likes: likes || 0,
      shares
    }
  });
}
