import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

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
  const blockedId = body?.blocked_user_id;

  if (!blockedId) {
    return NextResponse.json({ error: 'Missing blocked_user_id' }, { status: 400 });
  }

  if (blockedId === authContext.user.id) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  const { error } = await supabaseServer.from('wpx_blocks').insert({ blocker_id: authContext.user.id, blocked_id: blockedId }, { upsert: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
