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
  const userId = request.nextUrl.searchParams.get('user_id');
  const type = request.nextUrl.searchParams.get('type');
  const summary = request.nextUrl.searchParams.get('summary') === 'true';

  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

  if (summary) {
    let authContext;
    try {
      authContext = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { count, error: countError } = await supabaseServer
      .from('wpx_follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', userId);

    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

    const { data: existing, error: existingError } = await supabaseServer
      .from('wpx_follows')
      .select('followed_id')
      .eq('follower_id', authContext.user.id)
      .eq('followed_id', userId)
      .maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

    return NextResponse.json({ followerCount: count ?? 0, isFollowing: !!existing });
  }

  if (!type) return NextResponse.json({ error: 'Missing type' }, { status: 400 });

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
