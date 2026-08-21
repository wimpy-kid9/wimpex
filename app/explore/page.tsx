'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

type ExplorePost = {
  id: string;
  caption: string;
  hashtags?: string[];
  videoUrl?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  mediaType?: string;
  like_count?: number;
  favorite_count?: number;
  share_count?: number;
  createdAt?: string;
  author?: string;
  handle?: string;
};

type SortMode = 'trending' | 'newest';

// Rough engagement score used to rank the Trending tab. Shares count for
// more than favorites, favorites for more than likes, since sharing a post
// is the strongest signal that someone found it worth spreading.
function engagementScore(post: ExplorePost) {
  return (post.like_count ?? 0) + (post.favorite_count ?? 0) * 2 + (post.share_count ?? 0) * 3;
}

export default function ExplorePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('trending');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const response = await authedFetch('/api/posts');
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || 'Unable to load Explore right now.');
          setPosts([]);
          return;
        }
        setPosts(Array.isArray(payload.posts) ? payload.posts : []);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load Explore right now.');
      } finally {
        setLoading(false);
      }
    };

    void loadPosts();
  }, []);

  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      (post.hashtags || []).forEach((tag) => {
        const clean = tag.replace(/^#/, '').trim();
        if (!clean) return;
        counts.set(clean, (counts.get(clean) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
  }, [posts]);

  const sortedPosts = useMemo(() => {
    const copy = [...posts];
    if (sortMode === 'newest') {
      copy.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      copy.sort((a, b) => engagementScore(b) - engagementScore(a));
    }
    return copy;
  }, [posts, sortMode]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gold">Explore</p>
            <h1 className="text-display mt-3 text-3xl text-ivory">What's trending on WIMPEX</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate">Trending videos and hashtags across the whole platform, refreshed from what people are liking, favoriting, and sharing right now.</p>
          </div>
          <Link href="/search" className="inline-flex rounded-md bg-ivory/10 px-4 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/15">
            Search creators
          </Link>
        </div>
        <form onSubmit={handleSearchSubmit} className="mt-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search WIMPEX for creators, videos, or #hashtags"
            className="w-full rounded-2xl border border-hairline bg-panel-2/80 px-4 py-3 text-sm text-ivory shadow-inner shadow-black/20 focus:border-hairline-strong focus:outline-none"
          />
        </form>
      </section>

      {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

      {trendingHashtags.length > 0 ? (
        <section className="rounded-md border border-hairline bg-panel/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Trending hashtags</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {trendingHashtags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(`#${tag}`)}`}
                className="rounded-full border border-hairline bg-panel-2/80 px-4 py-2 text-sm text-blue-400 transition hover:border-gold hover:text-gold"
              >
                #{tag} <span className="text-slate">· {count}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-hairline bg-panel/70 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSortMode('trending')}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              sortMode === 'trending' ? 'border-gold bg-gold/10 text-gold' : 'border-hairline bg-transparent text-slate hover:text-ivory'
            }`}
          >
            Trending
          </button>
          <button
            type="button"
            onClick={() => setSortMode('newest')}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              sortMode === 'newest' ? 'border-gold bg-gold/10 text-gold' : 'border-hairline bg-transparent text-slate hover:text-ivory'
            }`}
          >
            Newest
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-md border border-hairline bg-panel/70 p-8 text-center text-sm text-slate">Loading what's trending…</div>
        ) : sortedPosts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {sortedPosts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="group relative block overflow-hidden rounded-2xl border border-hairline bg-panel-2/70 transition hover:border-gold"
              >
                <div className="aspect-square overflow-hidden bg-panel">
                  {post.thumbnailUrl || post.videoUrl ? (
                    <img
                      src={post.thumbnailUrl || post.videoUrl || ''}
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
                    <div className="grid h-full w-full place-items-center bg-panel-2 text-slate">No media</div>
                  )}
                </div>
                <div className="absolute left-2 top-2 flex items-center gap-2 rounded-full bg-black/60 px-2 py-1 text-[11px] text-ivory backdrop-blur">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M12 21s-6.7-4.35-9.33-8.02C.86 10.2 1.24 6.6 4.1 4.86A5.5 5.5 0 0 1 12 6.09a5.5 5.5 0 0 1 7.9-1.23c2.86 1.74 3.24 5.34 1.43 8.12C18.7 16.65 12 21 12 21z"/></svg>
                  {(post.like_count ?? 0) + (post.favorite_count ?? 0)}
                </div>
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                  <div className="text-sm text-slate line-clamp-2">{post.caption || post.handle || 'Video'}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-hairline bg-panel/70 p-8 text-center text-sm text-slate">
            Nothing to explore yet. Check back once more posts go live.
          </div>
        )}
      </section>
    </main>
  );
}