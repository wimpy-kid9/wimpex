import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing, error: existingError } = await supabaseServer
    .from('wpx_user_post_interactions')
    .select('id')
    .eq('user_id', authContext.user.id)
    .eq('post_id', params.id)
    .eq('interaction_type', 'not_interested')
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (!existing) {
    const { error } = await supabaseServer.from('wpx_user_post_interactions').insert({
      user_id: authContext.user.id,
      post_id: params.id,
      interaction_type: 'not_interested'
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}