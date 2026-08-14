"use client";

import FollowButton from './FollowButton';
import BlockButton from './BlockButton';
import GoldBadge from './GoldBadge';
import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { isGoldSubscription } from '@/lib/subscription';

export default function ProfileHeader({ profile, subscription }: { profile: any; subscription?: any | null }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await authedFetch('/api/profile');
        if (!resp.ok) return;
        const p = await resp.json();
        setCurrentUserId(p.profile?.user_id ?? null);
      } catch {
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
  const isGold = isGoldSubscription(subscription);

  return (
    <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name || profile.username || 'Profile avatar'} className={`h-20 w-20 rounded-full object-cover ring-2 ${isGold ? 'ring-gold/70 ring-offset-2 ring-offset-panel-2' : 'ring-white/10'}`} />
          ) : (
            <div className={`grid h-20 w-20 place-items-center rounded-full bg-panel-2 text-3xl font-semibold text-slate ring-2 ${isGold ? 'ring-gold/70 ring-offset-2 ring-offset-panel-2' : 'ring-white/10'}`}>
              {profile?.display_name?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || 'P'}
            </div>
          )}
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gold">Profile</p>
            <div className="mt-3 flex items-center gap-2">
              <h1 className="text-display text-3xl text-ivory">{profile?.display_name ?? 'Profile'}</h1>
              {isGold ? <GoldBadge size="md" inline /> : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate">{profile?.bio ?? 'This user has not added a bio.'}</p>
          </div>
        </div>

        {summary ? (
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="rounded-3xl bg-panel/80 px-4 py-3 text-center">
              <p className="text-2xl font-semibold text-ivory">{summary.followerCount ?? 0}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate">Followers</p>
            </div>
            <div className="rounded-3xl bg-panel/80 px-4 py-3 text-center">
              <p className="text-2xl font-semibold text-ivory">{summary.followingCount ?? 0}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate">Following</p>
            </div>
            <div className="rounded-3xl bg-panel/80 px-4 py-3 text-center">
              <p className="text-2xl font-semibold text-ivory">{summary.totalLikeCount ?? 0}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate">Likes</p>
            </div>
          </div>
        ) : null}

        <div>
          {isOwn ? (
            <div className="flex flex-wrap gap-2">
              {!isGold ? (
                <a href="/settings" className="rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-obsidian transition hover:bg-gold-deep">Upgrade to Gold</a>
              ) : null}
              <a href="/settings" className="rounded-2xl border border-hairline px-4 py-2 text-sm font-semibold text-ivory transition hover:bg-ivory/10">Edit profile</a>
              <a href="/calls" className="rounded-2xl border border-hairline px-4 py-2 text-sm font-semibold text-ivory transition hover:bg-ivory/10">Call history</a>
            </div>
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
