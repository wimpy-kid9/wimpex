import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isGoldSubscription } from '@/lib/subscription';

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

  const userIds = Array.from(new Set((unique || []).map((person) => person.user_id).filter(Boolean)));
  const subscriptionMap: Record<string, any> = {};

  if (userIds.length > 0) {
    const { data: subscriptions } = await supabaseServer
      .from('subscriptions')
      .select('user_id, status, current_period_end, plan_id, plans!plan_id(id, product_name, name, price, billing_interval)')
      .in('user_id', userIds)
      .eq('status', 'active')
      .order('current_period_end', { ascending: false });

    (subscriptions || []).forEach((subscription: any) => {
      if (subscription.user_id && !subscriptionMap[subscription.user_id]) {
        subscriptionMap[subscription.user_id] = subscription;
      }
    });
  }

  const people = unique.slice(0, 10).map((person) => ({
    ...person,
    is_gold: isGoldSubscription(subscriptionMap[person.user_id])
  }));

  return NextResponse.json({ people });
}
