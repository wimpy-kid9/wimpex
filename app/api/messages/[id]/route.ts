import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';

async function loadMessage(id: string, userId: string) {
  const { data, error } = await supabaseServer.from('wpx_messages').select('*').eq('id', id).eq('sender_id', userId).maybeSingle();
  return { data, error };
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!(await isUserGold(authContext.user.id))) return NextResponse.json({ error: 'Gold membership is required to edit messages.' }, { status: 403 });
  const { data: message, error } = await loadMessage(params.id, authContext.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!message) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  if (message.unsent_at || Date.now() - new Date(message.created_at).getTime() > 5 * 60 * 1000) return NextResponse.json({ error: 'Messages can only be edited within five minutes.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.body !== 'string' || !body.body.trim()) return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
  const { data, error: updateError } = await supabaseServer.from('wpx_messages').update({ body: body.body.trim(), edited_at: new Date().toISOString() }).eq('id', params.id).select().single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ message: data });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!(await isUserGold(authContext.user.id))) return NextResponse.json({ error: 'Gold membership is required to unsend messages.' }, { status: 403 });
  const { data: message, error } = await loadMessage(params.id, authContext.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!message) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  if (message.unsent_at || Date.now() - new Date(message.created_at).getTime() > 5 * 60 * 1000) return NextResponse.json({ error: 'Messages can only be unsent within five minutes.' }, { status: 403 });
  const { data, error: updateError } = await supabaseServer.from('wpx_messages').update({ body: null, media_url: null, unsent_at: new Date().toISOString() }).eq('id', params.id).select().single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
