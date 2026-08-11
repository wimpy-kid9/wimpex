"use client";

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { getUserAccent } from '@/lib/ui-theme';

export default function StoriesPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [postsResp, mutualResp] = await Promise.all([authedFetch('/api/posts'), authedFetch('/api/mutual-follows')]);
        const postsJson = await postsResp.json();
        const mutualJson = await mutualResp.json();
        const mutualIds = mutualJson.mutual || [];
        const items = (postsJson.posts || []).filter((p: any) => mutualIds.includes(p.author_id));
        setPosts(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load stories.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-[2rem] bg-slate-900/75 p-6">
        <h1 className="text-display text-3xl text-white">Stories</h1>
        <p className="mt-2 text-sm text-slate-400">Short, ephemeral-style posts from mutual followers.</p>
      </section>

      {loading ? <p className="text-sm text-slate-400">Loading stories…</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const accent = getUserAccent(post.author || 'story');
          const accentClass = post.accent || accent.gradient;
          return (
            <div key={post.id} className={`rounded-[1.5rem] bg-gradient-to-r ${accentClass} p-[1px]`}>
              <div className="rounded-[1.4rem] bg-slate-950/90 p-4">
                <p className="font-semibold text-white">{post.author}</p>
                {post.videoUrl ? <video src={post.videoUrl} className="mt-2 h-44 w-full object-cover rounded-md" controls /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
