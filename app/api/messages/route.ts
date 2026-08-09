import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

async function createNotification(userId: string, actorId: string | null, type: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseServerConfigured) return;
  await supabaseServer.from('wpx_notifications').insert({
    user_id: userId,
    actor_id: actorId,
    type,
    resource_type: 'message',
    resource_id: resourceId,
    metadata
  });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ conversations: [] });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get('conversation_id');
  if (conversationId) {
    const { data, error } = await supabaseServer.from('wpx_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ messages: data || [] });
  }

  const { data: memberships, error: membershipError } = await supabaseServer.from('wpx_conversation_members').select('conversation_id').eq('user_id', authContext.user.id);
  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const conversationIds = (memberships || []).map((row: any) => row.conversation_id);
  const { data: conversations, error: conversationError } = await supabaseServer.from('wpx_conversations').select('*').in('id', conversationIds).order('last_activity_at', { ascending: false });
  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: conversations || [] });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  if (!body.recipient_id || !body.body?.trim()) {
    return NextResponse.json({ error: 'Recipient and a message body are required.' }, { status: 400 });
  }

  const { data: connectionRows, error: connectionError } = await supabaseServer.from('wpx_connections').select('*').order('created_at', { ascending: false });
  if (connectionError) {
    return NextResponse.json({ error: connectionError.message }, { status: 500 });
  }

  const isAcceptedConnection = (connectionRows || []).some((row: any) => {
    const samePair = (row.requester_id === authContext.user.id && row.recipient_id === body.recipient_id) || (row.requester_id === body.recipient_id && row.recipient_id === authContext.user.id);
    return samePair && row.status === 'accepted';
  });

  if (!isAcceptedConnection) {
    return NextResponse.json({ error: 'Messaging is limited to accepted connections.' }, { status: 403 });
  }

  const { data: conversationData, error: conversationError } = await supabaseServer.from('wpx_conversations').insert({ type: 'direct', title: 'Direct message' }).select().single();
  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  const { error: membersError } = await supabaseServer.from('wpx_conversation_members').insert([
    { conversation_id: conversationData.id, user_id: authContext.user.id },
    { conversation_id: conversationData.id, user_id: body.recipient_id }
  ]);
  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const { data: messageData, error: messageError } = await supabaseServer.from('wpx_messages').insert({
    conversation_id: conversationData.id,
    sender_id: authContext.user.id,
    body: body.body.trim(),
    status: 'sent'
  }).select().single();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  await createNotification(body.recipient_id, authContext.user.id, 'message', conversationData.id, { conversation_id: conversationData.id });
  return NextResponse.json({ conversation: conversationData, message: messageData });
}
