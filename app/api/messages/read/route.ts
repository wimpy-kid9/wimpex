import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

export async function PATCH(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ ok: true });
  try {
    const authContext = await requireAuth(request);
    const { conversationId } = await request.json();
    if (!conversationId) return NextResponse.json({ error: 'conversationId is required.' }, { status: 400 });

    const { data: membership } = await supabaseServer
      .from('wpx_conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', authContext.user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabaseServer
      .from('wpx_messages')
      .update({ read_at: new Date().toISOString(), status: 'read' })
      .eq('conversation_id', conversationId)
      .neq('sender_id', authContext.user.id)
      .is('read_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
