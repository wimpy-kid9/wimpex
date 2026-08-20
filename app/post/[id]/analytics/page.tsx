'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';

export default function PostAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params?.id) return;
    void authedFetch(`/api/posts/${params.id}/analytics`).then(async (response) => {
      const next = await response.json();
      if (!response.ok) {
        setError(next.error || 'Unable to load analytics.');
        return;
      }
      setPayload(next);
    }).catch(() => setError('Unable to load analytics.'));
  }, [params?.id]);

  if (error) return <main className="p-8"><p className="text-sm text-rose-200">{error}</p><Link href="/settings/gold" className="mt-4 inline-block text-sm text-gold">Back to Gold</Link></main>;
  if (!payload) return <main className="p-8"><p className="text-sm text-slate">Loading analytics...</p></main>;

  const cards = [
    ['Views', payload.analytics.views],
    ['Average watch', `${Math.round(payload.analytics.averageWatchMs / 1000)}s`],
    ['Likes', payload.analytics.likes],
    ['Shares', payload.analytics.shares]
  ];

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/settings/gold" className="text-sm text-gold">Gold settings</Link>
          <h1 className="mt-3 text-4xl font-semibold text-ivory">Post analytics</h1>
          <p className="mt-2 text-sm text-slate">{payload.post.caption || 'Untitled post'}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value]) => <div key={label} className="gold-panel"><p className="text-xs uppercase tracking-[0.2em] text-slate">{label}</p><p className="mt-3 text-3xl font-semibold text-gold">{value}</p></div>)}
        </div>
      </div>
    </main>
  );
}
