"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserAccent } from '@/lib/ui-theme';

export default function HomePage() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const accent = getUserAccent('wimpex-home');

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: unknown } | null }) => {
      setIsSignedIn(Boolean(result?.data?.session));
    });
  }, []);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-2 py-8 sm:px-6 lg:px-8">
      <div className="surface-veil w-full max-w-4xl rounded-[2rem] bg-slate-900/70 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <p className={`text-sm font-medium uppercase tracking-[0.3em] ${accent.line.includes('amber') ? 'text-amber-300' : 'text-sky-300'}`}>WIMPEX</p>
        <h1 className="text-display mt-4 text-4xl text-white sm:text-5xl">A living social video layer for real connections.</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-400">
          Share video, build trusted circles, and move from feed to calls without leaving the same intimate space.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={isSignedIn ? '/feed' : '/login'} className={`rounded-2xl bg-gradient-to-r ${accent.gradient} px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110`}>
            {isSignedIn ? 'Open the feed' : 'Continue to WimpyID'}
          </Link>
          <Link href="/signup" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            Create account
          </Link>
          <Link href="/onboarding" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            View onboarding flow
          </Link>
        </div>
      </div>
    </main>
  );
}
