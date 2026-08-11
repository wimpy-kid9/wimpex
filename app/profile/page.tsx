"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserAccent } from '@/lib/ui-theme';
import { authedFetch } from '@/lib/api-client';
import ProfileHeader from '@/app/components/ProfileHeader';
import ProfileTabs from '@/app/components/ProfileTabs';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';

export default function ProfilePage() {
  const accent = getUserAccent('profile-shell');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    const load = async () => {
      const sessionResult = await supabase.auth.getSession();
      const sessionData = sessionResult?.data?.session ?? null;
      setSession(sessionData);

      if (!sessionData) {
        setLoading(false);
        return;
      }

      try {
        const response = await authedFetch('/api/profile');
        if (!response.ok) {
          setProfile(null);
          return;
        }
        const payload = await response.json();
        setProfile(payload.profile || null);
      } catch (err) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <main className="p-8">
        <p>Loading profile…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthActionPrompt
        title="Sign in to view your profile"
        description="Browse the feed publicly, then log in or sign up to access your profile, followers, and posting tools."
      />
    );
  }

  return (
    <main className="space-y-6">
      <ProfileHeader profile={profile} />
      <ProfileTabs profile={profile} isOwn={true} />

      <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
        <p>
          Learn more about how WIMPEX works in the <Link href="/privacy-policy" className="text-amber-300 hover:text-amber-200">Privacy Policy</Link> or read the <Link href="/terms-of-service" className="text-amber-300 hover:text-amber-200">Terms of Service</Link>.
        </p>
      </section>

      <section className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
        <p>
          Learn more about how WIMPEX works in the <Link href="/privacy-policy" className="text-amber-300 hover:text-amber-200">Privacy Policy</Link> or read the <Link href="/terms-of-service" className="text-amber-300 hover:text-amber-200">Terms of Service</Link>.
        </p>
      </section>
    </main>
  );
}
