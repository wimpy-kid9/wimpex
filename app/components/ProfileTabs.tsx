"use client";

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

export default function ProfileTabs({ profile, isOwn }: { profile: any; isOwn: boolean }) {
  const [active, setActive] = useState<'posts' | 'liked' | 'favorited' | 'followers' | 'following'>('posts');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      const userId = profile?.user_id;
      if (!userId) {
        setItems([]);
        setLoading(false);
        return;
      }

      try {
        if (active === 'posts') {
          const response = await fetch(`/api/posts?author_id=${encodeURIComponent(userId)}`);
          const payload = await response.json();
          setItems(payload.posts || []);
        } else if (active === 'liked') {
          const response = await authedFetch(`/api/posts?type=liked&author_id=${encodeURIComponent(userId)}`);
          const payload = await response.json();
          setItems(payload.posts || []);
        } else if (active === 'favorited') {
          const response = await authedFetch(`/api/posts?type=favorited&author_id=${encodeURIComponent(userId)}`);
          const payload = await response.json();
          setItems(payload.posts || []);
        } else if (active === 'followers') {
          const response = await fetch(`/api/follow?type=followers&user_id=${encodeURIComponent(userId)}`);
          const payload = await response.json();
          setItems((payload.followers || []).map((id: string) => ({ id, type: 'user' })));
        } else if (active === 'following') {
          const response = await fetch(`/api/follow?type=following&user_id=${encodeURIComponent(userId)}`);
          const payload = await response.json();
          setItems((payload.following || []).map((id: string) => ({ id, type: 'user' })));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [active, profile]);

  const tabs = [
    { label: 'Posts', value: 'posts' },
    ...(isOwn ? [{ label: 'Liked', value: 'liked' }, { label: 'Favorited', value: 'favorited' }] : []),
    { label: 'Followers', value: 'followers' },
    { label: 'Following', value: 'following' }
  ];

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value as any)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${active === tab.value ? 'bg-amber-400/20 text-amber-100' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">No items found.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                {item.type === 'user' ? (
                  <p className="text-sm text-slate-200">User ID: {item.id}</p>
                ) : (
                  <>
                    <p className="font-semibold text-white">{item.author || 'Unknown author'}</p>
                    <p className="mt-2 text-sm text-slate-400">{item.caption}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
