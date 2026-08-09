import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

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

    const { data, error } = await supabaseServer.from('wpx_calls').insert({
      caller_id: authContext.user.id,
      callee_id,
      connection_id: connection_id ?? null,
      call_type,
      status: 'ringing',
      room_id: `wimpex-${crypto.randomUUID()}`
    }).select().maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ call: data });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
