import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const followedId = body?.followed_id;
  if (!followedId) return NextResponse.json({ error: 'Missing followed_id' }, { status: 400 });
  if (followedId === authContext.user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });

  const { data: existing } = await supabaseServer.from('wpx_follows').select('*').eq('follower_id', authContext.user.id).eq('followed_id', followedId).maybeSingle();
  if (existing) {
    const { error } = await supabaseServer.from('wpx_follows').delete().eq('follower_id', authContext.user.id).eq('followed_id', followedId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ following: false });
  }

  const { error } = await supabaseServer.from('wpx_follows').insert({ follower_id: authContext.user.id, followed_id: followedId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ following: true });
}

export async function GET(request: NextRequest) {
  // /api/follow?user_id=<id>&type=followers|following
  const userId = request.nextUrl.searchParams.get('user_id');
  const type = request.nextUrl.searchParams.get('type');
  if (!userId || !type) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  if (type === 'followers') {
    const { data, error } = await supabaseServer.from('wpx_follows').select('follower_id').eq('followed_id', userId).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ followers: (data || []).map((r: any) => r.follower_id) });
  }

  if (type === 'following') {
    const { data, error } = await supabaseServer.from('wpx_follows').select('followed_id').eq('follower_id', userId).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ following: (data || []).map((r: any) => r.followed_id) });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
