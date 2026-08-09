import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

const usernamePattern = /^[A-Za-z0-9_]{3,20}$/;

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ profile: null });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from('wpx_profiles')
    .select('*')
    .eq('user_id', authContext.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ ok: true, profile: null });
  }

  const body = await request.json();

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username, display_name, date_of_birth, bio, gender, onboarding_completed_at } = body;

  if (username && !usernamePattern.test(username)) {
    return NextResponse.json({ error: 'Username must be 3–20 letters, numbers, or underscores.' }, { status: 400 });
  }

  if (username) {
    const { data: existing, error: existingError } = await supabaseServer
      .from('wpx_profiles')
      .select('user_id')
      .eq('username', username)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing && existing.user_id !== authContext.user.id) {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (username) updates.username = username;
  if (display_name) updates.display_name = display_name;
  if (date_of_birth) updates.date_of_birth = date_of_birth;
  if (bio !== undefined) updates.bio = bio;
  if (gender !== undefined) updates.gender = gender;
  if (onboarding_completed_at) updates.onboarding_completed_at = onboarding_completed_at;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No profile data provided.' }, { status: 400 });
  }

  const { error: upsertError } = await supabaseServer.from('wpx_profiles').upsert(
    {
      user_id: authContext.user.id,
      ...updates
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
