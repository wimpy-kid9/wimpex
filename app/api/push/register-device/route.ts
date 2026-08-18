import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const userId = authContext.user.id;

    const { token, platform } = await request.json();

    if (!token || !platform) {
      return NextResponse.json({ error: 'Missing device token fields: token, platform' }, { status: 400 });
    }

    if (platform !== 'android' && platform !== 'ios') {
      return NextResponse.json({ error: 'platform must be "android" or "ios"' }, { status: 400 });
    }

    // Upsert on token: if this exact device token is already registered
    // (same device, possibly a different account or a refreshed session),
    // re-point it at the current user rather than erroring on the unique
    // constraint.
    const { data, error } = await supabaseServer
      .from('wpx_device_push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'token' }
      )
      .select()
      .single();

    if (error) {
      console.error('Device token registration error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ device: data }, { status: 201 });
  } catch (err) {
    console.error('Device token registration error:', err);
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const userId = authContext.user.id;

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('wpx_device_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('Device token removal error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Device token removal error:', err);
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
