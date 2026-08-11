"use client";

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

export default function FollowButton({ userId }: { userId: string }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [shouldFollowBack, setShouldFollowBack] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const meResp = await authedFetch('/api/profile');
        let meId: string | null = null;
        if (meResp.ok) {
          const p = await meResp.json();
          meId = p.profile?.user_id ?? null;
          setCurrentUserId(meId);
        }

        const summaryResp = await authedFetch(`/api/follow?user_id=${userId}&summary=true`);
        if (!summaryResp.ok) {
          setFollowerCount(null);
          setFollowing(false);
          return;
        }
        const summary = await summaryResp.json();
        setFollowerCount(summary.followerCount ?? null);
        setFollowing(!!summary.isFollowing);
        setShouldFollowBack(!!summary.shouldFollowBack);
      } catch (err) {
        setFollowerCount(null);
        setFollowing(false);
      }
    };
    void init();
  }, [userId]);

  const toggleFollow = async () => {
    if (!userId || currentUserId === userId) return;
    setLoading(true);
    const prev = following;
    const prevCount = followerCount ?? 0;
    setFollowing(!prev);
    setFollowerCount(prev ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const resp = await authedFetch('/api/follow', { method: 'POST', body: JSON.stringify({ followed_id: userId }) });
      if (!resp.ok) {
        // rollback
        setFollowing(prev);
        setFollowerCount(prevCount);
        setLoading(false);
        return;
      }
      const json = await resp.json();
      setFollowing(json.following);
    } catch (err) {
      setFollowing(prev);
      setFollowerCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {followerCount !== null ? <div className="text-sm text-slate">{followerCount} followers</div> : null}
      {currentUserId && currentUserId !== userId ? (
        <button onClick={toggleFollow} disabled={loading} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${following ? 'bg-ivory/5 text-ivory' : 'bg-gold/20 text-gold'}`}>
          {following ? 'Following' : shouldFollowBack ? 'Follow Back' : 'Follow'}
        </button>
      ) : null}
    </div>
  );
}
