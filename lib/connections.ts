import { isSupabaseServerConfigured, supabaseServer } from './supabase-server';

export async function hasAcceptedConnection(userId: string, otherUserId: string) {
  if (!isSupabaseServerConfigured) {
    return false;
  }

  const { data, error } = await supabaseServer
    .from('wpx_connections')
    .select('requester_id, recipient_id, status')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).some((row: any) => {
    const samePair = (row.requester_id === userId && row.recipient_id === otherUserId) || (row.requester_id === otherUserId && row.recipient_id === userId);
    return samePair && row.status === 'accepted';
  });
}
