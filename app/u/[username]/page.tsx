import { notFound, redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';

interface Props {
  params: { username: string };
}

export default async function UsernameRedirectPage({ params }: Props) {
  const username = decodeURIComponent(params.username || '').trim();

  if (!username) {
    notFound();
  }

  const { data: profile } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id')
    .ilike('username', username)
    .maybeSingle();

  if (!profile?.user_id) {
    notFound();
  }

  redirect(`/user/${profile.user_id}`);
}
