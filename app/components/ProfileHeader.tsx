"use client";

import FollowButton from './FollowButton';
import BlockButton from './BlockButton';
import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

export default function ProfileHeader({ profile }: { profile: any }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await authedFetch('/api/profile');
        if (!resp.ok) return;
        const p = await resp.json();
        setCurrentUserId(p.profile?.user_id ?? null);
      } catch (err) {
        // ignore
      }
    };
    void load();
  }, []);

  const isOwn = profile?.user_id && currentUserId && profile.user_id === currentUserId;

  return (
    <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Profile</p>
          <h1 className="text-display mt-3 text-3xl text-ivory">{profile?.display_name ?? 'Profile'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate">{profile?.bio ?? 'This user has not added a bio.'}</p>
        </div>
        <div>
          {isOwn ? (
            <a href="/settings" className="rounded-2xl border border-hairline px-4 py-2 text-sm font-semibold text-ivory transition hover:bg-ivory/10">Edit profile</a>
          ) : (
            profile?.user_id ? (
              <div className="flex flex-wrap gap-2">
                <FollowButton userId={profile.user_id} />
                <BlockButton userId={profile.user_id} />
              </div>
            ) : null
          )}
        </div>
      </div>
    </section>
  );
}
