"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SVGProps } from 'react';
import { authedFetch } from '@/lib/api-client';

type TabValue = 'posts' | 'liked' | 'favorited' | 'drafts' | 'followers' | 'following';

/* ---------------------------------------------------------------------- */
/*  Inline icon set (no extra deps) — all inherit currentColor            */
/* ---------------------------------------------------------------------- */

function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </svg>
  );
}

function IconHeart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20.5s-7.5-4.6-10-9.3C.4 7.6 2.4 4 6 4c2.1 0 3.7 1.1 6 3.4C14.3 5.1 15.9 4 18 4c3.6 0 5.6 3.6 4 7.2-2.5 4.7-10 9.3-10 9.3z" />
    </svg>
  );
}

function IconBookmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function IconDraft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20l4.4-1 10-10-3.4-3.4-10 10L4 20z" />
      <path d="M13.5 6.5L17.5 10.5" />
    </svg>
  );
}

function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8.5" cy="8" r="3.2" />
      <path d="M2.2 20c0-3.3 2.8-5.7 6.3-5.7s6.3 2.4 6.3 5.7" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 6.2" />
      <path d="M16 14.5c2.7.4 4.8 2.4 4.8 5.5" />
    </svg>
  );
}

function IconUserCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 12l2 2 4-4" />
    </svg>
  );
}

function IconPlay(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */

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

  const ownerTabs: Array<{ label: string; value: TabValue; Icon: (p: SVGProps<SVGSVGElement>) => JSX.Element }> = [
    { label: 'Liked', value: 'liked', Icon: IconHeart },
    { label: 'Favorited', value: 'favorited', Icon: IconBookmark },
    { label: 'Drafts', value: 'drafts', Icon: IconDraft }
  ];

  const tabs: Array<{ label: string; value: TabValue; Icon: (p: SVGProps<SVGSVGElement>) => JSX.Element }> = [
    { label: 'Posts', value: 'posts', Icon: IconGrid },
    ...(isOwn ? ownerTabs : []),
    { label: 'Followers', value: 'followers', Icon: IconUsers },
    { label: 'Following', value: 'following', Icon: IconUserCheck }
  ];

  return (
    <section className="rounded-md border border-hairline bg-panel/70 p-5">
      <div className="flex items-center justify-center gap-1 border-b border-hairline pb-3 sm:justify-start sm:gap-2">
        {tabs.map((tab) => {
          const isActive = active === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-label={tab.label}
              title={tab.label}
              onClick={() => setActive(tab.value)}
              className={`relative grid h-11 w-11 place-items-center rounded-full transition ${
                isActive ? 'bg-gold/15 text-gold' : 'text-slate hover:bg-ivory/5 hover:text-ivory'
              }`}
            >
              <tab.Icon className="h-5 w-5" />
              {isActive ? <span className="absolute -bottom-3 h-0.5 w-6 rounded-full bg-gold" /> : null}
            </button>
          );
        })}
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
              <Link key={item.id} href={`/user/${item.id}`} className="rounded-3xl border border-hairline bg-panel-2/80 p-4 transition hover:border-gold hover:bg-panel/80">
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
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {items.map((item, index) => {
              const preview = item.thumbnailUrl || item.imageUrl || item.videoUrl || item.previewUrl || '';
              const isVideo = !!item.videoUrl;
              const postLink = active === 'liked' || active === 'favorited'
                ? `/post/${item.id}?from=${active}&index=${index}`
                : `/post/${item.id}`;
              return (
                <Link key={item.id} href={postLink} className="group relative block aspect-[9/16] overflow-hidden rounded-lg border border-hairline bg-black/40 transition hover:border-gold">
                  {preview ? (
                    <img src={preview} alt={item.caption || item.title || 'Post preview'} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-panel/80 text-xs text-slate">No preview</div>
                  )}
                  {isVideo ? (
                    <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-ivory backdrop-blur">
                      <IconPlay className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  {item.caption || item.title ? (
                    <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-[11px] text-ivory">
                      {item.caption || item.title}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
