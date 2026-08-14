import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

const SIGNAL_TYPES = new Set(['offer', 'answer', 'candidate']);

async function loadAuthorizedCall(callId: string, userId: string) {
  const { data: call, error } = await supabaseServer
    .from('wpx_calls')
    .select('id, caller_id, callee_id')
    .eq('id', callId)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!call) {
    return { error: NextResponse.json({ error: 'Call not found.' }, { status: 404 }) };
  }
  if (call.caller_id !== userId && call.callee_id !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { call };
}

// POST /api/calls/[id]/signal — a peer publishes their SDP offer/answer or an ICE candidate.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error: authzError } = await loadAuthorizedCall(params.id, authContext.user.id);
  if (authzError) return authzError;

  const body = await request.json();
  const { signal_type, payload } = body;

  if (!SIGNAL_TYPES.has(signal_type)) {
    return NextResponse.json({ error: "signal_type must be 'offer', 'answer', or 'candidate'." }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'payload is required.' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('wpx_call_signals')
    .insert({
      call_id: params.id,
      sender_id: authContext.user.id,
      signal_type,
      payload
    })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signal: data });
}

// GET /api/calls/[id]/signal?after=<ISO timestamp> — poll for signals sent by the OTHER
// participant in this call. Pass the created_at of the last signal you already have as
// `after` so repeated polls only return new signals.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error: authzError } = await loadAuthorizedCall(params.id, authContext.user.id);
  if (authzError) return authzError;

  const after = request.nextUrl.searchParams.get('after');

  let query = supabaseServer
    .from('wpx_call_signals')
    .select('*')
    .eq('call_id', params.id)
    .neq('sender_id', authContext.user.id)
    .order('created_at', { ascending: true });

  if (after) {
    query = query.gt('created_at', after);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signals: data ?? [] });
}
