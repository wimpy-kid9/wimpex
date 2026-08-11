"use client";

import FollowButton from './FollowButton';
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
    <section className="surface-veil rounded-[2rem] bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Profile</p>
          <h1 className="text-display mt-3 text-3xl text-white">{profile?.display_name ?? 'Profile'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">{profile?.bio ?? 'This user has not added a bio.'}</p>
        </div>
        <div>
          {isOwn ? (
            <a href="/settings" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Edit profile</a>
          ) : (
            profile?.user_id ? <FollowButton userId={profile.user_id} /> : null
          )}
        </div>
      </div>
    </section>
  );
}
