import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ profiles: [] });
  }

  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ids = request.nextUrl.searchParams.get('user_ids')?.split(',').map((id) => id.trim()).filter(Boolean);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const { data, error } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, username, display_name, bio, avatar_url')
    .in('user_id', ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: data || [] });
}
