import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

// GET /api/profile/[id] — public-safe profile lookup for another user.
// The base /api/profile route only ever returned the signed-in user's own
// profile, so any code fetching someone else's profile by id (e.g.
// IncomingCallNotification looking up the caller) was hitting a 404.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ profile: null });
  }

  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, username, display_name, avatar_url, bio')
    .eq('user_id', params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
