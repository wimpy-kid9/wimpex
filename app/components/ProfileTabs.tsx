"use client";

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

type TabValue = 'posts' | 'liked' | 'favorited' | 'drafts' | 'followers' | 'following';

export default function ProfileTabs({ profile, isOwn }: { profile: any; isOwn: boolean }) {
  const [active, setActive] = useState<TabValue>('posts');
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
        let response: Response | null = null;

        if (active === 'posts') {
          response = await fetch(`/api/posts?author_id=${encodeURIComponent(userId)}`);
        } else if (active === 'liked') {
          response = await authedFetch(`/api/posts?type=liked&author_id=${encodeURIComponent(userId)}`);
        } else if (active === 'favorited') {
          response = await authedFetch(`/api/posts?type=favorited&author_id=${encodeURIComponent(userId)}`);
        } else if (active === 'drafts') {
          response = await authedFetch(`/api/posts?type=drafts&author_id=${encodeURIComponent(userId)}`);
        } else if (active === 'followers') {
          response = await fetch(`/api/follow?type=followers&user_id=${encodeURIComponent(userId)}`);
        } else if (active === 'following') {
          response = await fetch(`/api/follow?type=following&user_id=${encodeURIComponent(userId)}`);
        }

        if (!response) {
          throw new Error('Unable to load data.');
        }

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load data.');
        }

        if (active === 'followers') {
          setItems((payload.followers || []).map((p: any) => ({ id: p.user_id || p.userId || p.id, type: 'user', profile: p })));
        } else if (active === 'following') {
          setItems((payload.following || []).map((p: any) => ({ id: p.user_id || p.userId || p.id, type: 'user', profile: p })));
        } else {
          setItems(payload.posts || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [active, profile]);

  const ownerTabs: Array<{ label: string; value: TabValue; icon: string }> = [
    { label: 'Liked', value: 'liked', icon: '❤️' },
    { label: 'Favorited', value: 'favorited', icon: '📌' },
    { label: 'Drafts', value: 'drafts', icon: '📝' }
  ];

  const tabs: { label: string; value: TabValue; icon: string }[] = [
    { label: 'Posts', value: 'posts', icon: '🖼️' },
    ...(isOwn ? ownerTabs : []),
    { label: 'Followers', value: 'followers', icon: '👥' },
    { label: 'Following', value: 'following', icon: '➡️' }
  ];

  return (
    <section className="rounded-md border border-hairline bg-panel/70 p-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActive(tab.value)}
            className={`inline-flex items-center gap-2 rounded-3xl px-4 py-3 text-sm font-semibold transition ${active === tab.value ? 'bg-gold/20 text-amber-100' : 'bg-ivory/5 text-ivory hover:bg-ivory/10'}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate">No items found.</p>
        ) : active === 'followers' || active === 'following' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <a key={item.id} href={`/user/${item.id}`} className="rounded-3xl border border-hairline bg-panel-2/80 p-4 transition hover:border-gold hover:bg-panel/80">
                <div className="flex items-center gap-3">
                  {item.profile?.avatar_url ? (
                    <img src={item.profile.avatar_url} alt={item.profile.display_name || item.profile.username} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-panel-2 text-sm text-slate">{item.profile?.display_name?.charAt(0)?.toUpperCase() || item.profile?.username?.charAt(0)?.toUpperCase() || 'U'}</div>
                  )}
                  <div>
                    <p className="font-semibold text-ivory">{item.profile?.display_name || item.profile?.username || item.id}</p>
                    <p className="text-xs text-slate">@{item.profile?.username || item.id}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const preview = item.thumbnailUrl || item.imageUrl || item.videoUrl || item.previewUrl || '';
              return (
                <div key={item.id} className="group relative overflow-hidden rounded-3xl border border-hairline bg-black/40">
                  {preview ? (
                    <img src={preview} alt={item.caption || item.title || 'Post preview'} className="h-48 w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-panel/80 text-sm text-slate">No preview</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ivory">{item.caption || item.title || 'Untitled'}</p>
                    <p className="text-xs text-slate">{item.handle || item.author || '@wimpex'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
