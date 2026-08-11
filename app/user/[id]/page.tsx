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

  return (
    <main className="p-8 space-y-6">
      <ProfileHeader profile={profile} />
      <ProfileTabs profile={profile} isOwn={false} />
    </main>
  );
}
