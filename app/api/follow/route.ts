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
  // create notification for followed user
  try {
    await supabaseServer.from('wpx_notifications').insert({ user_id: followedId, type: 'follow', metadata: { follower_id: authContext.user.id } });
  } catch {
    // ignore notification errors
  }
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

    const [{ count: followerCount, error: followerErr }, { count: followingCount, error: followingErr }] = await Promise.all([
      supabaseServer.from('wpx_follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId),
      supabaseServer.from('wpx_follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
    ]);

    if (followerErr) return NextResponse.json({ error: followerErr.message }, { status: 500 });
    if (followingErr) return NextResponse.json({ error: followingErr.message }, { status: 500 });

    const [{ data: isFollowingData, error: isFollowingErr }, { data: isFollowedByData, error: isFollowedByErr }] = await Promise.all([
      supabaseServer.from('wpx_follows').select('*').eq('follower_id', authContext.user.id).eq('followed_id', userId).maybeSingle(),
      supabaseServer.from('wpx_follows').select('*').eq('follower_id', userId).eq('followed_id', authContext.user.id).maybeSingle()
    ]);

    if (isFollowingErr) return NextResponse.json({ error: isFollowingErr.message }, { status: 500 });
    if (isFollowedByErr) return NextResponse.json({ error: isFollowedByErr.message }, { status: 500 });

    const isFollowing = !!isFollowingData;
    const isFollowedBy = !!isFollowedByData;
    const mutual = isFollowing && isFollowedBy;
    const shouldFollowBack = isFollowedBy && !isFollowing;

    return NextResponse.json({ followerCount: followerCount ?? 0, followingCount: followingCount ?? 0, isFollowing, isFollowedBy, mutual, shouldFollowBack });
  }

  if (!type) return NextResponse.json({ error: 'Missing type' }, { status: 400 });

  if (type === 'followers') {
    const { data, error } = await supabaseServer.from('wpx_follows').select('follower_id').eq('followed_id', userId).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const ids = (data || []).map((r: any) => r.follower_id).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ followers: [] });
    const { data: profiles, error: profErr } = await supabaseServer.from('wpx_profiles').select('user_id,username,display_name,avatar_url').in('user_id', ids);
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    return NextResponse.json({ followers: profiles || [] });
  }

  if (type === 'following') {
    const { data, error } = await supabaseServer.from('wpx_follows').select('followed_id').eq('follower_id', userId).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const ids = (data || []).map((r: any) => r.followed_id).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ following: [] });
    const { data: profiles, error: profErr } = await supabaseServer.from('wpx_profiles').select('user_id,username,display_name,avatar_url').in('user_id', ids);
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    return NextResponse.json({ following: profiles || [] });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
