import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ ok: true });
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const profileUserId = typeof body.profileUserId === 'string' ? body.profileUserId : '';
  if (!profileUserId || profileUserId === authContext.user.id) return NextResponse.json({ ok: true });

  const { error } = await supabaseServer.from('wpx_profile_views').upsert({
    profile_user_id: profileUserId,
    viewer_user_id: authContext.user.id,
    created_at: new Date().toISOString()
  }, { onConflict: 'profile_user_id,viewer_user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ viewers: [] });
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isUserGold(authContext.user.id))) {
    return NextResponse.json({ error: 'Gold membership is required for profile insights.' }, { status: 403 });
  }

  const { data: views, error } = await supabaseServer
    .from('wpx_profile_views')
    .select('viewer_user_id, created_at')
    .eq('profile_user_id', authContext.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const viewerIds = Array.from(new Set((views || []).map((view: any) => view.viewer_user_id).filter(Boolean)));
  const { data: profiles } = viewerIds.length ? await supabaseServer
    .from('wpx_profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', viewerIds) : { data: [] };
  const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));

  return NextResponse.json({ viewers: (views || []).map((view: any) => ({ ...view, profile: profileMap.get(view.viewer_user_id) || null })) });
}
