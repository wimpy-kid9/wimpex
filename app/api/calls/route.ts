import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasAcceptedConnection } from '@/lib/connections';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { createNotification } from '@/lib/notifications';

function normalizeStatus(value: string) {
  if (value === 'active') return 'active';
  if (value === 'ended') return 'ended';
  return value;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const { data, error } = await supabaseServer
      .from('wpx_calls')
      .select('*')
      .or(`caller_id.eq.${authContext.user.id},callee_id.eq.${authContext.user.id}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ calls: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const body = await request.json();
    const { callee_id, call_type = 'voice', connection_id } = body;

    if (!callee_id) {
      return NextResponse.json({ error: 'A callee is required.' }, { status: 400 });
    }

    if (callee_id === authContext.user.id) {
      return NextResponse.json({ error: 'You cannot call yourself.' }, { status: 400 });
    }

    if (!(await hasAcceptedConnection(authContext.user.id, callee_id))) {
      return NextResponse.json({ error: 'Calls are limited to accepted connections.' }, { status: 403 });
    }

    const { data: privacyData, error: privacyError } = await supabaseServer
      .from('wpx_privacy_settings')
      .select('call_privacy')
      .eq('user_id', callee_id)
      .maybeSingle();

    if (privacyError) {
      return NextResponse.json({ error: privacyError.message }, { status: 500 });
    }

    const callPrivacy = privacyData?.call_privacy ?? 'connections';
    if (callPrivacy === 'no_one') {
      return NextResponse.json({ error: 'This user is not accepting calls right now.' }, { status: 403 });
    }

    if (callPrivacy === 'connections' && !(await hasAcceptedConnection(authContext.user.id, callee_id))) {
      return NextResponse.json({ error: 'Calls are limited to accepted connections.' }, { status: 403 });
    }

    // WebRTC-based calling: no need to provision an external room
    // The call ID is used as the signaling channel
    const { data, error } = await supabaseServer.from('wpx_calls').insert({
      caller_id: authContext.user.id,
      callee_id,
      connection_id: connection_id ?? null,
      call_type,
      status: 'ringing'
    }).select().maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      const { data: callerProfile } = await supabaseServer
        .from('wpx_profiles')
        .select('username, display_name')
        .eq('user_id', authContext.user.id)
        .maybeSingle();
      const callerName = callerProfile?.display_name || callerProfile?.username || 'Someone';
      await createNotification({
        userId: callee_id,
        actorId: authContext.user.id,
        type: 'incoming_call',
        resourceType: 'call',
        resourceId: data.id,
        metadata: { call_id: data.id, room_id: data.room_id, call_type, caller_name: callerName },
        push: {
          title: callerName,
          body: call_type === 'video' ? 'Incoming video call' : 'Incoming voice call',
          url: `/calls?call_id=${data.id}`,
          tag: `call-${data.id}`,
          requireInteraction: true,
          channelId: 'wimpex-calls',
          sound: 'default',
          data: { type: 'incoming_call', callId: data.id, callerId: authContext.user.id, callerName }
        }
      });
    }

    return NextResponse.json({ call: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'A call id is required.' }, { status: 400 });
    }

    const { data: existingCall, error: existingCallError } = await supabaseServer
      .from('wpx_calls')
      .select('id, caller_id, callee_id')
      .eq('id', id)
      .maybeSingle();

    if (existingCallError) {
      return NextResponse.json({ error: existingCallError.message }, { status: 500 });
    }

    if (!existingCall) {
      return NextResponse.json({ error: 'Call not found.' }, { status: 404 });
    }

    if (existingCall.caller_id !== authContext.user.id && existingCall.callee_id !== authContext.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextStatus = normalizeStatus(status);
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString()
    };

    if (nextStatus === 'ended') {
      updatePayload.ended_at = new Date().toISOString();
    }

    if (nextStatus === 'active') {
      updatePayload.started_at = new Date().toISOString();
    }

    const { data, error } = await supabaseServer
      .from('wpx_calls')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Call not found.' }, { status: 404 });
    }

    if (nextStatus === 'missed') {
      await createNotification({
        userId: data.caller_id,
        actorId: data.callee_id,
        type: 'missed_call',
        resourceType: 'call',
        resourceId: data.id,
        metadata: { call_id: data.id, room_id: data.room_id },
        push: { title: 'Missed call', body: 'You missed a call.', url: `/calls?call_id=${data.id}`, tag: `missed-call-${data.id}` }
      });
    }

    return NextResponse.json({ call: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 401 });
  }
}
