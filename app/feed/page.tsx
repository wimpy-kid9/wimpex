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
    <main className="space-y-6">
      {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {loading ? <p className="text-sm text-slate">Loading feed…</p> : null}

      <div className="mt-4">
        <div className="flex gap-3">
          <button onClick={() => setActiveTab('books')} className={`px-3 py-2 rounded-2xl ${activeTab === 'books' ? 'bg-gold/10 text-ivory' : 'text-slate hover:bg-ivory/5'}`}>Books</button>
          <button onClick={() => setActiveTab('feed')} className={`px-3 py-2 rounded-2xl ${activeTab === 'feed' ? 'bg-gold/10 text-ivory' : 'text-slate hover:bg-ivory/5'}`}>Feed</button>
          <button onClick={() => setActiveTab('friends')} className={`px-3 py-2 rounded-2xl ${activeTab === 'friends' ? 'bg-gold/10 text-ivory' : 'text-slate hover:bg-ivory/5'}`}>Friends</button>
        </div>

        {activeTab === 'books' ? (
          <div className="mt-4 rounded-2xl border border-hairline bg-panel-2/70 p-6 text-slate">
            <p className="text-sm">WimpyBooks</p>
            <p className="mt-2 text-sm">Open the WimpyBooks reader.</p>
            <a href="https://wimpybooks.netlify.app" target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-4 py-2 text-sm font-semibold text-obsidian">Open WimpyBooks</a>
          </div>
        ) : (
          <div className="feed-snap-stack flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4 mt-4">
            {posts.filter((post) => {
              if (activeTab === 'friends') {
                if (!followingIds || !post.author_id) return false;
                return followingIds.includes(post.author_id);
              }
              return true;
            }).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
        {showCreatedToast ? (
          <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gold/90 px-4 py-2 text-sm font-semibold text-obsidian shadow-lg">Post published</div>
        ) : null}
    </main>
  );
}
