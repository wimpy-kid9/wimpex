"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: unknown } | null }) => {
      setIsSignedIn(Boolean(result?.data?.session));
    });
  }, []);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-2 py-8 sm:px-6 lg:px-8">
      <div className="surface-veil w-full max-w-4xl rounded-[2rem] bg-slate-900/70 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">WIMPEX • Phase 1</p>
        <h1 className="text-display mt-4 text-4xl text-white sm:text-5xl">A social video app with room to grow.</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-400">
          The shell is now live with onboarding, feed, posting, and profile surfaces so the next build step can focus on real integration rather than empty placeholders.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={isSignedIn ? '/feed' : '/login'} className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
            {isSignedIn ? 'Open the feed' : 'Continue to WimpyID'}
          </Link>
          <Link href="/onboarding" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            View onboarding flow
          </Link>
        </div>
      </div>
    </main>
  );
}
