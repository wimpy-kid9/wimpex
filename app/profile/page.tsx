"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';
import ProfileHeader from '@/app/components/ProfileHeader';
import ProfileTabs from '@/app/components/ProfileTabs';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
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
        setSubscription(payload.subscription || null);
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
      <ProfileHeader profile={profile} subscription={subscription} />
      <ProfileTabs profile={profile} isOwn={true} />

      <section className="rounded-md border border-hairline bg-panel-2/80 p-6 text-sm text-slate">
        <p>
          Learn more about how WIMPEX works in the <Link href="/privacy-policy" className="text-gold hover:text-gold">Privacy Policy</Link> or read the <Link href="/terms-of-service" className="text-gold hover:text-gold">Terms of Service</Link>.
        </p>
      </section>

      <section className="rounded-md border border-hairline bg-panel-2/80 p-6 text-sm text-slate">
        <p>
          Learn more about how WIMPEX works in the <Link href="/privacy-policy" className="text-gold hover:text-gold">Privacy Policy</Link> or read the <Link href="/terms-of-service" className="text-gold hover:text-gold">Terms of Service</Link>.
        </p>
      </section>
    </main>
  );
}
