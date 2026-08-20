import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isGoldSubscription } from '@/lib/subscription';

async function requireGold(userId: string) {
  const { data: subscription } = await supabaseServer
    .from('subscriptions')
    .select('status, current_period_end, plan_id, plans!plan_id(id, product_name, name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  return isGoldSubscription(subscription);
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await requireGold(authContext.user.id))) {
    return NextResponse.json({ error: 'Gold membership is required to pin chats.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.conversationId !== 'string' || typeof body.pinned !== 'boolean') {
    return NextResponse.json({ error: 'conversationId and pinned are required.' }, { status: 400 });
  }

  const { data: membership } = await supabaseServer
    .from('wpx_conversation_members')
    .select('conversation_id')
    .eq('conversation_id', body.conversationId)
    .eq('user_id', authContext.user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseServer
    .from('wpx_conversation_members')
    .update({ pinned_at: body.pinned ? new Date().toISOString() : null })
    .eq('conversation_id', body.conversationId)
    .eq('user_id', authContext.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, pinned: body.pinned });
}
