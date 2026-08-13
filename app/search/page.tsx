'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'people' | 'videos'>('people');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [videoResults, setVideoResults] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session ?? null);
    };
    void loadSession();
  }, []);

  useEffect(() => {
    if (!session) return;

    const timeout = window.setTimeout(async () => {
      if (!query.trim()) {
        setPeopleResults([]);
        setVideoResults([]);
        setStatus('');
        return;
      }

      try {
        const [peopleRes, videosRes] = await Promise.all([
          authedFetch(`/api/people?q=${encodeURIComponent(query)}`),
          authedFetch(`/api/posts?search=${encodeURIComponent(query)}`)
        ]);

        const peoplePayload = await peopleRes.json();
        if (peopleRes.ok) {
          setPeopleResults(peoplePayload.people || []);
        }

        const videosPayload = await videosRes.json();
        if (videosRes.ok) {
          setVideoResults(videosPayload.posts || []);
        }

        setStatus('');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Unable to search');
        setPeopleResults([]);
        setVideoResults([]);
      }
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [query, session]);

  if (session === undefined) {
    return (
      <main className="space-y-6">
        <p className="text-sm text-slate">Loading search…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthActionPrompt
        title="Sign in to search"
        description="Search for creators, videos, and content by usernames, captions, and hashtags."
      />
    );
  }

  const currentResults = tab === 'people' ? peopleResults : videoResults;
  const hasAnyResults = peopleResults.length > 0 || videoResults.length > 0;

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gold">Search</p>
            <h1 className="text-display mt-3 text-3xl text-ivory">Discover creators and content</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate">Find people, videos, captions, and hashtags across WIMPEX.</p>
          </div>
          <Link href="/messages" className="inline-flex rounded-md bg-ivory/10 px-4 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/15">
            Go to messages
          </Link>
        </div>
      </section>

      <section className="rounded-md border border-hairline bg-panel/70 p-6">
        <label className="text-sm text-slate">Search by name, caption, or hashtag</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for creators, videos, #hashtags, or topics"
          className="mt-3 w-full rounded-2xl border border-hairline bg-panel-2/80 px-4 py-3 text-sm text-ivory shadow-inner shadow-black/20 focus:border-hairline-strong focus:outline-none"
        />
      </section>

      {status ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{status}</p> : null}

      {hasAnyResults && query.trim() ? (
        <section className="rounded-md border border-hairline bg-panel/70 p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('people')}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                tab === 'people'
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-hairline bg-transparent text-slate hover:text-ivory'
              }`}
            >
              People ({peopleResults.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('videos')}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                tab === 'videos'
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-hairline bg-transparent text-slate hover:text-ivory'
              }`}
            >
              Videos ({videoResults.length})
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {tab === 'people' ? (
          peopleResults.length > 0 ? (
            peopleResults.map((person) => (
              <Link key={person.user_id} href={`/user/${person.user_id}`} className="block rounded-md border border-hairline bg-panel-2/80 p-5 transition hover:border-amber-400/30 hover:bg-panel/90">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt={person.display_name || person.username} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-panel-2 text-sm font-semibold text-slate">
                        {person.display_name?.charAt(0)?.toUpperCase() || person.username?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-semibold text-ivory">{person.display_name || person.username}</p>
                      <p className="text-sm text-slate">@{person.username}</p>
                      {person.bio ? <p className="mt-2 text-sm text-slate">{person.bio}</p> : null}
                    </div>
                  </div>
                  <span className="rounded-full bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-gold">View profile</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-hairline bg-panel/70 p-8 text-center text-sm text-slate">
              {query.trim() ? 'No matching creators found.' : 'Enter a search term to find profiles.'}
            </div>
          )
        ) : videoResults.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {videoResults.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="group relative block overflow-hidden rounded-2xl border border-hairline bg-panel-2/70 transition hover:border-gold"
              >
                <div className="aspect-square overflow-hidden bg-panel">
                  {post.thumbnailUrl || post.videoUrl ? (
                    <img
                      src={post.thumbnailUrl || post.videoUrl}
                      alt={post.caption || 'Video'}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.caption || 'Image'}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-panel-2 text-slate">
                      No media
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                  <div className="text-sm text-slate line-clamp-2">{post.caption || 'Video'}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-hairline bg-panel/70 p-8 text-center text-sm text-slate">
            {query.trim() ? 'No matching videos found.' : 'Enter a search term to find videos.'}
          </div>
        )}
      </section>
    </main>
  );
}
