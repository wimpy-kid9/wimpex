"use client";

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import PostCard from '@/app/components/PostCard';
import GoldUpgradeHint from '@/app/components/GoldUpgradeHint';
import { isGoldSubscription } from '@/lib/subscription';

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // const [actionMessage, setActionMessage] = useState('');
  const [showCreatedToast, setShowCreatedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'books' | 'feed' | 'friends'>('feed');
  const [feedFilter, setFeedFilter] = useState<'all' | 'video' | 'image' | 'recent' | 'popular'>('all');
  const [followingIds, setFollowingIds] = useState<string[] | null>(null);
  const [isGold, setIsGold] = useState(false);
  const [hideGoldNudge, setHideGoldNudge] = useState(false);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await authedFetch('/api/posts');
        const payload = await response.json();
        setPosts(Array.isArray(payload.posts) ? payload.posts : []);
        setError(payload.error ? payload.error : '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load feed.');
      } finally {
        setLoading(false);
      }
    };

    void loadPosts();
  }, []);

  useEffect(() => {
    const loadProfilePrefs = async () => {
      try {
        const response = await authedFetch('/api/profile');
        const payload = await response.json();
        setHideGoldNudge(Boolean(payload.profile?.gold_feed_nudges_hidden));
      } catch {
        setHideGoldNudge(false);
      }
    };

    void loadProfilePrefs();
  }, []);

  useEffect(() => {
    void authedFetch('/api/wimpypay').then((response) => response.json()).then((payload) => setIsGold(isGoldSubscription(payload.subscription))).catch(() => setIsGold(false));
  }, []);

  useEffect(() => {
    const loadFollowing = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId) return setFollowingIds([]);
      const resp = await authedFetch(`/api/follow?user_id=${encodeURIComponent(userId)}&type=following`);
      const payload = await resp.json();
      setFollowingIds((payload.following || []).map((profile: any) => profile.user_id));
    };
    void loadFollowing();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('created') === '1') {
      setShowCreatedToast(true);
      const t = window.setTimeout(() => setShowCreatedToast(false), 3500);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, []);

  const handleDismissGoldNudge = async () => {
    setHideGoldNudge(true);
    try {
      const response = await authedFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ gold_feed_nudges_hidden: true })
      });
      if (!response.ok) {
        setHideGoldNudge(false);
      }
    } catch {
      setHideGoldNudge(false);
    }
  };

  const visiblePosts = posts
    .filter((post) => {
      if (activeTab === 'friends') {
        if (!followingIds || !post.author_id) return false;
        return followingIds.includes(post.author_id);
      }
      return true;
    })
    .filter((post) => {
      if (feedFilter === 'video' && post.mediaType !== 'video') return false;
      if (feedFilter === 'image' && post.mediaType !== 'image') return false;
      return true;
    })
    .sort((a, b) => {
      if (feedFilter === 'popular') {
        return (b.like_count ?? 0) + (b.favorite_count ?? 0) + (b.share_count ?? 0) - ((a.like_count ?? 0) + (a.favorite_count ?? 0) + (a.share_count ?? 0));
      }
      return new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime();
    });

  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian text-ivory [--header-h:72px] [--bottomnav-h:calc(4.5rem+env(safe-area-inset-bottom))]">
      <div className="fixed inset-x-0 top-0 z-20 border-b border-hairline bg-panel/95 backdrop-blur-xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('feed')} className={`rounded-full px-3 py-2 text-sm font-semibold ${activeTab === 'feed' ? 'bg-gold/20 text-ivory' : 'text-slate hover:bg-ivory/10'}`}>For You</button>
            <button onClick={() => setActiveTab('friends')} className={`rounded-full px-3 py-2 text-sm font-semibold ${activeTab === 'friends' ? 'bg-gold/20 text-ivory' : 'text-slate hover:bg-ivory/10'}`}>Following</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'video', 'image', 'popular'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFeedFilter(option)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${feedFilter === option ? 'bg-gold text-obsidian' : 'bg-panel-2 text-slate hover:text-ivory'}`}
              >
                {option === 'all' ? 'All' : option === 'video' ? 'Videos' : option === 'image' ? 'Images' : 'Popular'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel/70 px-3 py-2 text-sm text-slate hover:bg-ivory/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4"><circle cx="11" cy="11" r="6" strokeWidth="1.5"/><path d="m20 20-4.2-4.2" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Search
            </Link>
            <Link href="/explore" className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel/70 px-3 py-2 text-sm text-slate hover:bg-ivory/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Explore
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-[var(--header-h)] bottom-0 overflow-y-auto snap-y snap-mandatory feed-snap-stack">
        {error ? <div className="mx-4 mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
        {loading ? <div className="mx-4 mt-5 rounded-2xl border border-hairline bg-panel-2/70 px-4 py-3 text-sm text-slate">Loading feed…</div> : null}

        {visiblePosts.map((post, index) => (
          <Fragment key={post.id}>
            {/* Each post gets its own dedicated, exactly-one-screen snap slot.
               Nothing else shares this slot, so the next post can never
               peek through or shift this one out of alignment.
               No scroll-margin here: the container's top is already offset
               below the header via top-[var(--header-h)], so adding the
               header height again as scroll-margin would make every snap
               land short and leave the previous post's tail showing. */}
            <div className="snap-start [scroll-snap-stop:always]">
              <PostCard post={post} isFeedItem />
            </div>
            {!isGold && !hideGoldNudge && index > 0 && index % 6 === 5 ? (
              <div className="snap-start flex min-h-[3.5rem] items-center justify-between gap-3 bg-obsidian px-4 py-3">
                <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-panel-2/90 px-4 py-3 text-sm text-slate">
                  <span>Make more of every post with Gold.</span>
                  <div className="flex items-center gap-2"><GoldUpgradeHint compact perk="Gold creator perks" detail="Unlock exclusive filters and 3-minute posts." /><button type="button" onClick={() => void handleDismissGoldNudge()} className="text-xs text-slate hover:text-ivory" aria-label="Dismiss Gold feed nudge">Dismiss</button></div>
                </div>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>

      {showCreatedToast ? (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gold/90 px-4 py-2 text-sm font-semibold text-obsidian shadow-lg">Post published</div>
      ) : null}
    </main>
  );
}