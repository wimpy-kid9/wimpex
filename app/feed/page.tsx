"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { type FeedPost, type FeedVisibility } from '@/lib/models';
import { getUserAccent } from '@/lib/ui-theme';

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<FeedVisibility>('public');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await fetch('/api/posts');
        const payload = await response.json();
        const nextPosts = Array.isArray(payload.posts)
          ? payload.posts.map((post: any) => ({
              id: post.id,
              author: post.author,
              handle: post.handle,
              caption: post.caption,
              visibility: post.visibility,
              createdAt: post.createdAt,
              accent: post.accent
            }))
          : [];

        setPosts(nextPosts);
        setError(payload.error ? payload.error : '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load feed.');
      } finally {
        setLoading(false);
      }
    };

    void loadPosts();
    supabase.auth.getSession().then((result: { data: { session: any } | null }) => {
      setSession(result?.data?.session ?? null);
    });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() && !videoFile) return;

    const headers: Record<string, string> = {};

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    if (!videoFile) {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: draft.trim(), visibility })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || 'Unable to publish post.');
        return;
      }

      const payload = await response.json();
      if (payload.post) {
        setPosts((current) => [payload.post, ...current]);
        setError('');
      }

      setDraft('');
      setVisibility('public');
      setVideoFile(null);
      return;
    }

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('caption', draft.trim());
    formData.append('visibility', visibility);

    const response = await fetch('/api/posts', {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || 'Unable to publish post.');
      return;
    }

    const payload = await response.json();
    if (payload.post) {
      setPosts((current) => [payload.post, ...current]);
      setError('');
    }

    setDraft('');
    setVisibility('public');
    setVideoFile(null);
  };

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-[2rem] bg-slate-900/75 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Feed</p>
            <h1 className="text-display mt-3 text-3xl text-white">The latest from your circle</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Posts now flow through the configured Supabase project so your feed and onboarding profile can persist beyond a local demo.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            <p className="font-semibold">Private by default</p>
            <p className="mt-1 text-xs text-slate-400">Built for later Supabase sync.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="animate-drift mt-6 space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What are you sharing today?"
            className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as FeedVisibility)}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-100"
              >
                <option value="public">Public</option>
                <option value="connections">Connections only</option>
                <option value="private">Private</option>
              </select>
              <label className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-200">
                <input type="file" accept="video/*" className="sr-only" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />
                {videoFile ? `Video ready: ${videoFile.name}` : 'Upload video'}
              </label>
            </div>
            <button type="submit" className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Publish update
            </button>
          </div>
        </form>
      </section>

      {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {actionMessage ? <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">{actionMessage}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading feed…</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {posts.map((post) => {
          const accent = getUserAccent(post.author || post.handle || 'wimpex-post');
          const accentClass = post.accent || `${accent.gradient}`;
          return (
            <article key={post.id} className="thread-card surface-veil rounded-[2rem] bg-slate-900/80 p-5 shadow-lg shadow-black/20 backdrop-blur-xl">
              <div className={`rounded-[1.5rem] bg-gradient-to-r ${accentClass} p-[1px]`}>
              <div className="rounded-[1.4rem] bg-slate-950/90 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">{post.author}</p>
                    <p className="text-sm text-slate-400">{post.handle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={async () => {
                      const response = await fetch('/api/reports', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reported_post_id: post.id, report_type: 'content', reason: 'Inappropriate content' })
                      });
                      const payload = await response.json();
                      setActionMessage(payload.ok ? 'Report recorded.' : payload.error || 'Unable to submit report.');
                    }} className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300 transition hover:bg-white/10">
                      Report
                    </button>
                    <span className={`thread-pill rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300`}>
                      {post.visibility}
                    </span>
                  </div>
                </div>
                {post.videoUrl ? (
                  <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/70">
                    <video controls src={post.videoUrl} className="h-56 w-full object-cover" />
                  </div>
                ) : null}
                <p className="mt-4 text-sm leading-7 text-slate-300">{post.caption}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {new Date(post.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </article>
          );
        })}
      </div>
    </main>
  );
}
