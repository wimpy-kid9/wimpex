import { supabaseServer } from '@/lib/supabase-server';

export async function recordCallLog(call: any) {
  const { data: callerMemberships, error: callerError } = await supabaseServer
    .from('wpx_conversation_members')
    .select('conversation_id')
    .eq('user_id', call.caller_id);
  const { data: calleeMemberships, error: calleeError } = await supabaseServer
    .from('wpx_conversation_members')
    .select('conversation_id')
    .eq('user_id', call.callee_id);

  if (callerError || calleeError) return;
  const calleeConversationIds = new Set((calleeMemberships || []).map((row: any) => row.conversation_id));
  let conversationId = (callerMemberships || [])
    .map((row: any) => row.conversation_id)
    .find((id: string) => calleeConversationIds.has(id));

  if (!conversationId) {
    const { data: conversation, error: conversationError } = await supabaseServer
      .from('wpx_conversations')
      .insert({ type: 'direct', title: 'Direct message' })
      .select('id')
      .single();
    if (conversationError || !conversation) return;
    conversationId = conversation.id;
    await supabaseServer.from('wpx_conversation_members').insert([
      { conversation_id: conversationId, user_id: call.caller_id },
      { conversation_id: conversationId, user_id: call.callee_id }
    ]);
  }

  const duration = call.started_at && call.ended_at
    ? Math.max(0, Math.round((new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000))
    : null;
  const direction = call.status === 'missed' ? 'Incoming call' : 'Call';
  const body = call.status === 'missed'
    ? 'Missed call'
    : `${direction}${duration !== null ? ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : ''}`;

  const { data: existing } = await supabaseServer
    .from('wpx_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('media_type', 'call_log')
    .contains('metadata', { call_id: call.id })
    .maybeSingle();
  if (existing) return;

  await supabaseServer.from('wpx_messages').insert({
    conversation_id: conversationId,
    sender_id: call.caller_id,
    body,
    media_type: 'call_log',
    metadata: { call_id: call.id, direction, duration, status: call.status, ended_at: call.ended_at || null }
  });
}
