import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isUserGold } from '@/lib/gold';
import { supabaseServer } from '@/lib/supabase-server';

export async function PATCH(request: NextRequest) {
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!(await isUserGold(authContext.user.id))) return NextResponse.json({ error: 'Gold membership is required for group admin tools.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const conversationId = typeof body.conversation_id === 'string' ? body.conversation_id : '';
  const targetUserId = typeof body.user_id === 'string' ? body.user_id : '';
  const action = body.action;
  if (!conversationId || !targetUserId || !['remove', 'promote', 'demote'].includes(action)) return NextResponse.json({ error: 'conversation_id, user_id, and a valid action are required.' }, { status: 400 });

  const { data: actor } = await supabaseServer.from('wpx_conversation_members').select('role').eq('conversation_id', conversationId).eq('user_id', authContext.user.id).maybeSingle();
  const { data: conversation } = await supabaseServer.from('wpx_conversations').select('type').eq('id', conversationId).maybeSingle();
  if (!conversation || conversation.type !== 'group' || !actor || !['owner', 'admin'].includes(actor.role)) return NextResponse.json({ error: 'Only group admins can manage members.' }, { status: 403 });
  if (targetUserId === authContext.user.id && action === 'remove') return NextResponse.json({ error: 'An admin cannot remove themselves.' }, { status: 400 });

  if (action === 'remove') {
    const { error } = await supabaseServer.from('wpx_conversation_members').delete().eq('conversation_id', conversationId).eq('user_id', targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseServer.from('wpx_conversation_members').update({ role: action === 'promote' ? 'admin' : 'member' }).eq('conversation_id', conversationId).eq('user_id', targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}