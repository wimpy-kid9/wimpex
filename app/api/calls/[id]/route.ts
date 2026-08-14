import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

async function createNotification(userId: string, actorId: string | null, type: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseServerConfigured) return;
  await supabaseServer.from('wpx_notifications').insert({
    user_id: userId,
    actor_id: actorId,
    type,
    resource_type: 'call',
    resource_id: resourceId,
    metadata
  });
}

function normalizeStatus(value: string) {
  if (value === 'active') return 'active';
  if (value === 'ended') return 'ended';
  return value;
}

// GET /api/calls/[id] — fetch a single call the requester is part of.
// Used by e.g. IncomingCallNotification / call-status polling.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const { data, error } = await supabaseServer
      .from('wpx_calls')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Call not found.' }, { status: 404 });
    }

    if (data.caller_id !== authContext.user.id && data.callee_id !== authContext.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ call: data });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

// PATCH /api/calls/[id] — update a call's status (accept/decline/end).
// The client (lib/use-calling.ts) has always called this RESTful shape;
// only the id-in-body version existed on the base /api/calls route, which
// caused these requests to 404.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const body = await request.json();
    const { status } = body;

    const { data: existingCall, error: existingCallError } = await supabaseServer
      .from('wpx_calls')
      .select('id, caller_id, callee_id')
      .eq('id', params.id)
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
      .eq('id', params.id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Call not found.' }, { status: 404 });
    }

    if (nextStatus === 'missed' || nextStatus === 'declined') {
      await createNotification(data.caller_id, data.callee_id, nextStatus === 'declined' ? 'declined_call' : 'missed_call', data.id, { call_id: data.id, room_id: data.room_id });
    }

    return NextResponse.json({ call: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 401 });
  }
}
