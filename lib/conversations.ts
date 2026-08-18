import { supabaseServer } from '@/lib/supabase-server';

/**
 * Finds the existing direct (1:1) conversation between two users, or
 * creates one if none exists yet. Shared between the messages API (used
 * when someone opens a chat or sends the first message) and the
 * connections API (used so an accepted connection shows up in the chat
 * list immediately, before either side has sent anything).
 */
export async function findOrCreateDirectConversation(authUserId: string, recipientId: string) {
  const { data: existingMemberships, error: membershipError } = await supabaseServer
    .from('wpx_conversation_members')
    .select('conversation_id, user_id')
    .in('user_id', [authUserId, recipientId]);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const counts = (existingMemberships || []).reduce((acc: Record<string, number>, row: any) => {
    acc[row.conversation_id] = (acc[row.conversation_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const existingConversationId = Object.keys(counts).find((conversationId) => counts[conversationId] === 2);
  if (existingConversationId) {
    const { data, error } = await supabaseServer.from('wpx_conversations').select('*').eq('id', existingConversationId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data: dataConversation, error: conversationError } = await supabaseServer
    .from('wpx_conversations')
    .insert({ type: 'direct', title: null })
    .select()
    .single();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  const { error: membersError } = await supabaseServer.from('wpx_conversation_members').insert([
    { conversation_id: dataConversation.id, user_id: authUserId },
    { conversation_id: dataConversation.id, user_id: recipientId }
  ]);
  if (membersError) {
    throw new Error(membersError.message);
  }

  return dataConversation;
}
