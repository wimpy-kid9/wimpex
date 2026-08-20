import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';

export async function PATCH(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!(await isUserGold(authContext.user.id))) return NextResponse.json({ error: 'Gold membership is required for chat folders.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.conversationId !== 'string' || (body.folderName !== null && typeof body.folderName !== 'string')) return NextResponse.json({ error: 'Invalid folder request.' }, { status: 400 });
  const folderName = body.folderName ? body.folderName.trim().slice(0, 30) : null;
  const { data: membership } = await supabaseServer.from('wpx_conversation_members').select('conversation_id').eq('conversation_id', body.conversationId).eq('user_id', authContext.user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { error } = await supabaseServer.from('wpx_conversation_members').update({ folder_name: folderName }).eq('conversation_id', body.conversationId).eq('user_id', authContext.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, folderName });
}
