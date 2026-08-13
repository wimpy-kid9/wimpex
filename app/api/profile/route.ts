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

  const [{ data: profile, error: profileError }, { data: streak, error: streakError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabaseServer.from('wpx_profiles').select('*').eq('user_id', authContext.user.id).maybeSingle(),
    supabaseServer
      .from('wpx_streaks')
      .select('*')
      .eq('user_id', authContext.user.id)
      .eq('streak_type', 'daily_post')
      .maybeSingle(),
    supabaseServer
      .from('wpx_subscriptions')
      .select('*')
      .eq('user_id', authContext.user.id)
      .eq('status', 'active')
      .order('active_until', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (streakError) {
    return NextResponse.json({ error: streakError.message }, { status: 500 });
  }
  if (subscriptionError) {
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
  }

  return NextResponse.json({ profile, streak: streak || null, subscription: subscription || null });
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

  const { username, display_name, date_of_birth, bio, gender, onboarding_completed_at, message_privacy, call_privacy } = body;

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

  if (Object.keys(updates).length > 0) {
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
  }

  if (message_privacy || call_privacy) {
    const privacyValue = message_privacy ? (['everyone', 'connections', 'no_one'].includes(message_privacy) ? message_privacy : null) : null;
    const callPrivacyValue = call_privacy ? (['everyone', 'connections', 'no_one'].includes(call_privacy) ? call_privacy : null) : null;

    if (message_privacy && !privacyValue) {
      return NextResponse.json({ error: 'Invalid message privacy selection.' }, { status: 400 });
    }

    if (call_privacy && !callPrivacyValue) {
      return NextResponse.json({ error: 'Invalid call privacy selection.' }, { status: 400 });
    }

    const { error: privacyError } = await supabaseServer.from('wpx_privacy_settings').upsert(
      {
        user_id: authContext.user.id,
        message_privacy: privacyValue ?? 'connections',
        call_privacy: callPrivacyValue ?? 'connections'
      },
      { onConflict: 'user_id' }
    );

    if (privacyError) {
      return NextResponse.json({ error: privacyError.message }, { status: 500 });
    }
  }

  if (Object.keys(updates).length === 0 && !message_privacy && !call_privacy) {
    return NextResponse.json({ error: 'No profile data provided.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
