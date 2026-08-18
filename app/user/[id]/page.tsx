import { notFound } from 'next/navigation';
import ProfileHeader from '@/app/components/ProfileHeader';
import ProfileTabs from '@/app/components/ProfileTabs';
import { supabaseServer } from '@/lib/supabase-server';

interface Props {
  params: { id: string };
}

export default async function UserPage({ params }: Props) {
  const { id } = params;

  if (!id) {
    notFound();
  }

  // Fetch public profile for the given user id
  const { data: profile, error } = await supabaseServer.from('wpx_profiles').select('*').eq('user_id', id).maybeSingle();
  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-semibold">User</h1>
        <p className="mt-2 text-slate">Unable to load user profile.</p>
      </main>
    );
  }

  // Fetch this user's active subscription so visitors can see their gold badge too.
  // Previously only /app/profile (the owner's own view) loaded subscription data
  // and passed it to ProfileHeader, so anyone visiting someone else's profile
  // never saw the gold badge even if that user was subscribed.
  const { data: subscription } = await supabaseServer
    .from('subscriptions')
    .select('id, user_id, status, current_period_end, plan_id, plans!plan_id(id, product_name, name, price, billing_interval)')
    .eq('user_id', id)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="p-8 space-y-6">
      <ProfileHeader profile={profile} subscription={subscription} />
      <ProfileTabs profile={profile} isOwn={false} />
    </main>
  );
}
