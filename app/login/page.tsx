"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const redirect = window.location.origin;
    const nextUrl = `https://id.wimpy-corp.com.ng/login?redirect=${encodeURIComponent(redirect)}`;
    setRedirectUrl(nextUrl);
    window.location.href = nextUrl;
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/95 p-8 text-center shadow-2xl shadow-slate-950/40 sm:p-10">
          <p className="text-sm uppercase tracking-[0.32em] text-amber-300">Sign in</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Redirecting to WimpyID…</h1>
          <p className="mt-4 text-slate-400">If you are not redirected automatically, please use the button below.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a className="inline-flex rounded-2xl bg-gradient-to-r from-amber-400 to-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110" href={redirectUrl || 'https://id.wimpy-corp.com.ng/login'}>
              Continue to WimpyID
            </a>
            <Link className="inline-flex rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10" href="/signup">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
