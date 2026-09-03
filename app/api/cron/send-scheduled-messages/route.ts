import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { createNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ sent: 0 });
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: due, error } = await supabaseServer
    .from('wpx_messages')
    .select('id, conversation_id, sender_id, body, scheduled_at')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const message of due) {
    const { data: members, error: membersError } = await supabaseServer
      .from('wpx_conversation_members')
      .select('user_id')
      .eq('conversation_id', message.conversation_id);
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });

    const { data: claimed, error: clearError } = await supabaseServer
      .from('wpx_messages')
      .update({ scheduled_at: null })
      .eq('id', message.id)
      .eq('scheduled_at', message.scheduled_at)
      .select('id');
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
    if (!claimed?.length) continue;

    for (const member of (members || []).filter((item: any) => item.user_id !== message.sender_id)) {
      await createNotification({
        userId: member.user_id,
        actorId: message.sender_id,
        type: 'message',
        resourceType: 'message',
        resourceId: message.id,
        metadata: { conversation_id: message.conversation_id },
        push: { title: 'Scheduled message', body: message.body || 'You received a scheduled message.', url: `/messages?conversation_id=${message.conversation_id}`, tag: `message-${message.id}` }
      });
    }
    sent += 1;
  }

  return NextResponse.json({ sent });
}