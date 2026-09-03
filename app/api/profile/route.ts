import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';
import { isThemeName } from '@/lib/theme';

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
      .from('subscriptions')
      .select('id, user_id, status, current_period_end, plan_id, plans!plan_id(id, product_name, name, price, billing_interval)')
      .eq('user_id', authContext.user.id)
      .eq('status', 'active')
      .order('current_period_end', { ascending: false })
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

async function updateProfileFromBody(body: any, authContext: any) {
  const { username, display_name, date_of_birth, bio, gender, onboarding_completed_at, avatar_url, message_privacy, call_privacy, notification_sound, theme_preference, custom_links, digest_notifications, quiet_hours_start, quiet_hours_end, gold_feed_nudges_hidden } = body;

  const normalizedUsername = typeof username === 'string' ? username.trim() : username;

  if (normalizedUsername && !usernamePattern.test(normalizedUsername)) {
    return NextResponse.json({ error: 'Username must be 3–20 letters, numbers, or underscores.' }, { status: 400 });
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, username')
    .eq('user_id', authContext.user.id)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  if (!existingProfile && !normalizedUsername) {
    return NextResponse.json(
      { error: 'No profile exists yet — username is required to create one.' },
      { status: 400 }
    );
  }

  if (normalizedUsername) {
    const { data: existing, error: existingError } = await supabaseServer
      .from('wpx_profiles')
      .select('user_id')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing && existing.user_id !== authContext.user.id) {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (normalizedUsername) updates.username = normalizedUsername;
  if (display_name !== undefined) updates.display_name = display_name;
  if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth;
  if (bio !== undefined) updates.bio = bio;
  if (gender !== undefined) updates.gender = gender;
  if (onboarding_completed_at !== undefined) updates.onboarding_completed_at = onboarding_completed_at;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;
  if (notification_sound !== undefined) {
    const allowedSounds = ['default', 'chime', 'pop', 'marimba'];
    if (!allowedSounds.includes(notification_sound)) return NextResponse.json({ error: 'Invalid notification sound.' }, { status: 400 });
    if (notification_sound !== 'default' && !(await isUserGold(authContext.user.id))) {
      return NextResponse.json({ error: 'Gold membership is required for custom notification sounds.' }, { status: 403 });
    }
    updates.notification_sound = notification_sound;
  }
  if (theme_preference !== undefined) {
    if (!isThemeName(theme_preference)) return NextResponse.json({ error: 'Invalid theme selection.' }, { status: 400 });
    if (!(await isUserGold(authContext.user.id))) {
      return NextResponse.json({ error: 'Gold membership is required for custom themes.' }, { status: 403 });
    }
    updates.theme_preference = theme_preference;
  }
  if (gold_feed_nudges_hidden !== undefined) {
    if (typeof gold_feed_nudges_hidden !== 'boolean') return NextResponse.json({ error: 'Invalid Gold feed preference.' }, { status: 400 });
    if (!(await isUserGold(authContext.user.id))) {
      return NextResponse.json({ error: 'Gold membership is required for ad-free feed settings.' }, { status: 403 });
    }
    updates.gold_feed_nudges_hidden = gold_feed_nudges_hidden;
  }
  if (custom_links !== undefined || digest_notifications !== undefined || quiet_hours_start !== undefined || quiet_hours_end !== undefined) {
    if (!(await isUserGold(authContext.user.id))) return NextResponse.json({ error: 'Gold membership is required for these settings.' }, { status: 403 });
  }
  if (custom_links !== undefined) {
    if (!Array.isArray(custom_links) || custom_links.length > 5 || custom_links.some((link: any) => !link || typeof link.label !== 'string' || typeof link.url !== 'string' || !/^https:\/\//i.test(link.url))) {
      return NextResponse.json({ error: 'Links must contain up to five HTTPS URLs with labels.' }, { status: 400 });
    }
    updates.custom_links = custom_links.map((link: any) => ({ label: link.label.trim().slice(0, 40), url: link.url.trim().slice(0, 500) }));
  }
  if (digest_notifications !== undefined) {
    if (typeof digest_notifications !== 'boolean') return NextResponse.json({ error: 'Invalid digest setting.' }, { status: 400 });
    updates.digest_notifications = digest_notifications;
  }
  for (const [key, value] of [['quiet_hours_start', quiet_hours_start], ['quiet_hours_end', quiet_hours_end]] as const) {
    if (value !== undefined && value !== null && value !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NextResponse.json({ error: 'Quiet hours must use HH:MM.' }, { status: 400 });
    if (value !== undefined) updates[key] = value || null;
  }

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

  return updateProfileFromBody(body, authContext);
}

export async function PATCH(request: NextRequest) {
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

  return updateProfileFromBody(body, authContext);
}
