import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ people: [] });
  }

  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ people: [] });
  }

  const searchTerm = `%${query}%`;
  const { data: usernameMatches, error: usernameError } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, username, display_name, bio, avatar_url')
    .ilike('username', searchTerm)
    .limit(10);

  if (usernameError) {
    return NextResponse.json({ error: usernameError.message }, { status: 500 });
  }

  const { data: displayNameMatches, error: displayNameError } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, username, display_name, bio, avatar_url')
    .ilike('display_name', searchTerm)
    .limit(10);

  if (displayNameError) {
    return NextResponse.json({ error: displayNameError.message }, { status: 500 });
  }

  const merged = [...(usernameMatches || []), ...(displayNameMatches || [])];
  const unique = merged.filter((person, index, self) => self.findIndex((candidate) => candidate.user_id === person.user_id) === index);
  return NextResponse.json({ people: unique.slice(0, 10) });
}
