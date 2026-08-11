import { notFound } from 'next/navigation';
import ProfileHeader from '@/app/components/ProfileHeader';
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
        <p className="mt-2 text-slate-600">Unable to load user profile.</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <ProfileHeader profile={profile} />
      <section className="mt-6">
        <p className="text-slate-400">Public profile content for {profile?.display_name ?? id}.</p>
      </section>
    </main>
  );
}
