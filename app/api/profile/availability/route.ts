import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
