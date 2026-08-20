"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';
import ProfileHeader from '@/app/components/ProfileHeader';
import ProfileTabs from '@/app/components/ProfileTabs';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';
import GoldUpgradeHint from '@/app/components/GoldUpgradeHint';
import { isGoldSubscription } from '@/lib/subscription';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [session, setSession] = useState<any>(undefined);
  const [profileViewers, setProfileViewers] = useState<any[]>([]);

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
        if (isGoldSubscription(payload.subscription)) {
          const viewsResponse = await authedFetch('/api/profile/views');
          if (viewsResponse.ok) setProfileViewers((await viewsResponse.json()).viewers || []);
        }
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
      {profileViewers.length > 0 ? <section className="rounded-3xl border border-gold/30 bg-gold/5 p-5"><p className="text-xs uppercase tracking-[0.28em] text-gold">Gold profile insights</p><h2 className="mt-2 text-xl font-semibold text-ivory">Recent profile viewers</h2><div className="mt-4 flex flex-wrap gap-2">{profileViewers.slice(0, 8).map((viewer) => <span key={viewer.viewer_user_id} className="rounded-full border border-gold/20 bg-panel/60 px-3 py-2 text-xs text-ivory">{viewer.profile?.display_name || viewer.profile?.username || 'Wimpex member'}</span>)}</div></section> : null}
      {!isGoldSubscription(subscription) ? <GoldUpgradeHint compact perk="Profile view insights" detail="Gold members can see who has recently viewed their profile." /> : null}
      <ProfileTabs profile={profile} isOwn={true} />

      <section className="rounded-md border border-hairline bg-panel-2/80 p-6 text-sm text-slate">
        <p>
          Learn more about how WIMPEX works in the <Link href="/privacy-policy" className="text-gold hover:text-gold">Privacy Policy</Link> or read the <Link href="/terms-of-service" className="text-gold hover:text-gold">Terms of Service</Link>.
        </p>
      </section>
    </main>
  );
}
