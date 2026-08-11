"use client";

import FollowButton from './FollowButton';
import BlockButton from './BlockButton';
import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

export default function ProfileHeader({ profile }: { profile: any }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

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

  useEffect(() => {
    const loadSummary = async () => {
      if (!profile?.user_id) return;
      try {
        const resp = await authedFetch(`/api/follow?user_id=${encodeURIComponent(profile.user_id)}&summary=true`);
        if (!resp.ok) return;
        const j = await resp.json();
        setSummary(j);
      } catch {
        // ignore
      }
    };
    void loadSummary();
  }, [profile?.user_id]);

  const isOwn = profile?.user_id && currentUserId && profile.user_id === currentUserId;

  return (
    <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Profile</p>
          <h1 className="text-display mt-3 text-3xl text-ivory">{profile?.display_name ?? 'Profile'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate">{profile?.bio ?? 'This user has not added a bio.'}</p>
          <div className="mt-3 flex items-center gap-4 text-sm text-slate">
            <div>{summary ? summary.followerCount ?? 0 : '—'} followers</div>
            <div>{summary ? summary.followingCount ?? 0 : '—'} following</div>
            {summary?.shouldFollowBack ? <div className="text-gold">Follows you — follow back?</div> : null}
            {summary?.mutual ? <div className="text-ivory/80">Follows each other</div> : null}
          </div>
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
