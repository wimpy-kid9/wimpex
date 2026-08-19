"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import PostCard from '@/app/components/PostCard';

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // const [actionMessage, setActionMessage] = useState('');
  const [showCreatedToast, setShowCreatedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'books' | 'feed' | 'friends'>('feed');
  const [followingIds, setFollowingIds] = useState<string[] | null>(null);

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
    const loadFollowing = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id;
      if (!userId) return setFollowingIds([]);
      const resp = await authedFetch(`/api/follow?user_id=${encodeURIComponent(userId)}&type=following`);
      const payload = await resp.json();
      setFollowingIds(payload.following || []);
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-obsidian text-ivory [--header-h:72px] [--bottomnav-h:calc(4.5rem+env(safe-area-inset-bottom))]">
      <div className="fixed inset-x-0 top-0 z-20 border-b border-hairline bg-panel/95 backdrop-blur-xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('feed')} className={`rounded-full px-3 py-2 text-sm font-semibold ${activeTab === 'feed' ? 'bg-gold/20 text-ivory' : 'text-slate hover:bg-ivory/10'}`}>For You</button>
            <button onClick={() => setActiveTab('friends')} className={`rounded-full px-3 py-2 text-sm font-semibold ${activeTab === 'friends' ? 'bg-gold/20 text-ivory' : 'text-slate hover:bg-ivory/10'}`}>Following</button>
          </div>
          <Link href="/search" className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel/70 px-3 py-2 text-sm text-slate hover:bg-ivory/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4"><circle cx="11" cy="11" r="6" strokeWidth="1.5"/><path d="m20 20-4.2-4.2" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Search
          </Link>
        </div>
      </div>

      <div className="absolute inset-x-0 top-[var(--header-h)] bottom-0 overflow-y-auto snap-y snap-mandatory feed-snap-stack">
        {error ? <div className="mx-4 mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
        {loading ? <div className="mx-4 mt-5 rounded-2xl border border-hairline bg-panel-2/70 px-4 py-3 text-sm text-slate">Loading feed…</div> : null}

        {posts.filter((post) => {
          if (activeTab === 'friends') {
            if (!followingIds || !post.author_id) return false;
            return followingIds.includes(post.author_id);
          }
          return true;
        }).map((post) => (
          <PostCard key={post.id} post={post} isFeedItem />
        ))}
      </div>

      {showCreatedToast ? (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gold/90 px-4 py-2 text-sm font-semibold text-obsidian shadow-lg">Post published</div>
      ) : null}
    </main>
  );
}
