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
          setItems((payload.followers || []).map((p: any) => ({ id: p.user_id || p.userId || p.id, type: 'user', profile: p })));
        } else if (active === 'following') {
          const response = await fetch(`/api/follow?type=following&user_id=${encodeURIComponent(userId)}`);
          const payload = await response.json();
          setItems((payload.following || []).map((p: any) => ({ id: p.user_id || p.userId || p.id, type: 'user', profile: p })));
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
    <section className="rounded-md border border-hairline bg-panel/70 p-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value as any)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${active === tab.value ? 'bg-gold/20 text-amber-100' : 'bg-ivory/5 text-ivory hover:bg-ivory/10'}`}
          >
            {tab.label}
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
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const previewUrl = item.thumbnailUrl || item.imageUrl || item.videoUrl || null;
              const isVideo = item.mediaType === 'video' && !!item.videoUrl;

              return (
                <div key={item.id} className="rounded-2xl border border-hairline bg-panel-2/80 p-4">
                  {item.type === 'user' ? (
                    <a href={`/user/${item.id}`} className="block">
                      <div className="flex items-center gap-3">
                        {item.profile?.avatar_url ? (
                          <img src={item.profile.avatar_url} alt={item.profile.display_name || item.profile.username} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-panel-2 text-sm text-slate">
                            {item.profile?.display_name?.charAt(0)?.toUpperCase() || item.profile?.username?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-ivory">{item.profile?.display_name || item.profile?.username || item.id}</p>
                          <p className="text-xs text-slate">@{item.profile?.username || item.id}</p>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
                      <div className="flex items-center gap-3">
                        {item.avatar_url ? (
                          <img src={item.avatar_url} alt={item.author || item.handle || 'Author avatar'} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-panel-2 text-sm text-slate">
                            {item.author?.charAt(0)?.toUpperCase() || item.handle?.charAt(1)?.toUpperCase() || 'W'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="font-semibold text-ivory">{item.author || 'Unknown author'}</p>
                          <p className="text-xs text-slate">{item.handle || '@wimpex'}</p>
                        </div>
                        <p className="text-sm text-slate">{item.caption || 'No caption yet.'}</p>
                        {previewUrl ? (
                          <div className="overflow-hidden rounded-3xl border border-hairline bg-panel/80">
                            {isVideo ? (
                              <video
                                muted
                                playsInline
                                loop
                                src={item.videoUrl}
                                poster={item.thumbnailUrl || ''}
                                className="h-28 w-full object-cover"
                              />
                            ) : (
                              <img src={previewUrl} alt={item.caption || 'Post preview'} className="h-28 w-full object-cover" />
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
