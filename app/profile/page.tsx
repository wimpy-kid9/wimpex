"use client";

import Link from 'next/link';
import { useState } from 'react';
import { getUserAccent } from '@/lib/ui-theme';

export default function ProfilePage() {
  const accent = getUserAccent('ayo-t');
  const [message, setMessage] = useState('');

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-[2rem] bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Profile</p>
            <h1 className="text-display mt-3 text-3xl text-white">Ayo, creator and host</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              This profile surface is ready for onboarding data, connection stats, and future WIMPEX media highlights.
            </p>
          </div>
          <Link href="/settings" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            Edit profile
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
          <div className="thread-card rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${accent.gradient} text-xl font-semibold text-white shadow-lg shadow-amber-500/20`}>
                A
              </div>
              <div>
                <p className="text-xl font-semibold text-white">Ayo T.</p>
                <p className="text-sm text-slate-400">@ayo</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              Sharing short-form video, conversations, and playful experiments with connections who want more depth than a standard feed.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-semibold text-white">24</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Posts</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">189</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Connections</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">7</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Streak days</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={async () => {
              const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reported_user_id: 'demo-user', report_type: 'user', reason: 'Harassment' })
              });
              const payload = await response.json();
              setMessage(payload.ok ? 'Report recorded.' : payload.error || 'Unable to submit report.');
            }} className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20">
              Report profile
            </button>
            <button type="button" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
              Block user
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-amber-200">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
