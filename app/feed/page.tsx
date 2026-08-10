"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type FeedPost } from '@/lib/models';
import { getUserAccent } from '@/lib/ui-theme';

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
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
  }, []);

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-[2rem] bg-slate-900/75 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Feed</p>
            <h1 className="text-display mt-3 text-3xl text-white">The latest from your circle</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              The feed is now a review surface, while the create experience lives on its own page for a calmer, more intentional post flow.
            </p>
          </div>
          <Link href="/post" className="inline-flex rounded-[1.1rem] bg-gradient-to-r from-amber-400 to-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110">
            Create a post
          </Link>
        </div>
      </section>

      {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
      {actionMessage ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{actionMessage}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading feed…</p> : null}

      <div className="feed-snap-stack flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
        {posts.map((post) => {
          const accent = getUserAccent(post.author || post.handle || 'wimpex-post');
          const accentClass = post.accent || `${accent.gradient}`;
          return (
            <article key={post.id} className="feed-snap-item thread-card surface-veil rounded-[2rem] bg-slate-900/80 p-5 shadow-lg shadow-black/20 backdrop-blur-xl min-h-[78vh] md:min-h-0">
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
                      <span className="thread-pill rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                        {post.visibility}
                      </span>
                    </div>
                  </div>
                  {post.videoUrl ? (
                    <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/70">
                      <video controls src={post.videoUrl} className="h-[56vh] w-full object-cover md:h-56" />
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
