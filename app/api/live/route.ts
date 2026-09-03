import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const { data, error } = await supabaseServer.from('wpx_live_streams').select('*').eq('status', 'live').order('started_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ streams: data || [] });
}

export async function POST(request: NextRequest) {
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  if (!title) return NextResponse.json({ error: 'Stream title is required.' }, { status: 400 });
  const { data, error } = await supabaseServer.from('wpx_live_streams').insert({ host_id: authContext.user.id, title, provider: body.provider || 'external', provider_stream_id: body.provider_stream_id || null }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stream: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string') return NextResponse.json({ error: 'Stream id is required.' }, { status: 400 });
  const { data, error } = await supabaseServer.from('wpx_live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', body.id).eq('host_id', authContext.user.id).eq('status', 'live').select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Live stream not found.' }, { status: 404 });
  return NextResponse.json({ stream: data });
}