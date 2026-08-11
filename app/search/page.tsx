'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
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
        setResults([]);
        setStatus('');
        return;
      }

      try {
        const response = await authedFetch(`/api/people?q=${encodeURIComponent(query)}`);
        const payload = await response.json();
        if (!response.ok) {
          setStatus(payload.error || 'Unable to search users');
          setResults([]);
          return;
        }
        setResults(payload.people || []);
        setStatus('');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Unable to search users');
        setResults([]);
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
        title="Sign in to search people"
        description="Search for other creators and messages by searching usernames and profiles."
      />
    );
  }

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gold">Search</p>
            <h1 className="text-display mt-3 text-3xl text-ivory">Discover people</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate">Search for profiles by display name or username and open conversations with your accepted connections.</p>
          </div>
          <Link href="/messages" className="inline-flex rounded-md bg-ivory/10 px-4 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/15">
            Go to messages
          </Link>
        </div>
      </section>

      <section className="rounded-md border border-hairline bg-panel/70 p-6">
        <label className="text-sm text-slate">Search by name or handle</label>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for creators, friends, or connections"
          className="mt-3 w-full rounded-2xl border border-hairline bg-panel-2/80 px-4 py-3 text-sm text-ivory shadow-inner shadow-black/20 focus:border-hairline-strong focus:outline-none"
        />
      </section>

      {status ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{status}</p> : null}

      <section className="space-y-3">
        {results.length > 0 ? (
          results.map((person) => (
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
            {query.trim() ? 'No matching users found.' : 'Enter a search term to find profiles.'}
          </div>
        )}
      </section>
    </main>
  );
}
