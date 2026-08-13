import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ streak: null });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseServer
    .from('wpx_streaks')
    .select('*')
    .eq('user_id', authContext.user.id)
    .eq('streak_type', 'daily_post')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ streak: data || null });
}
