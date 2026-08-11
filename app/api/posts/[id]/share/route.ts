import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;

  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: post, error: postError } = await supabaseServer.from('wpx_posts').select('share_count').eq('id', postId).maybeSingle();
  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 });
  const nextCount = (post?.share_count ?? 0) + 1;
  const res = await supabaseServer.from('wpx_posts').update({ share_count: nextCount }).eq('id', postId).select().maybeSingle();
  if ((res as any).error) return NextResponse.json({ error: (res as any).error.message }, { status: 500 });
  return NextResponse.json({ ok: true, share_count: nextCount });
}
