"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export default function LoginPage() {
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Inside the native app, a plain https redirect just lands in Chrome
    // with nothing to hand control back to the app. The custom scheme is
    // claimed by an intent-filter in AndroidManifest.xml, so Android routes
    // it straight back into WIMPEX instead.
    const redirect = Capacitor.isNativePlatform()
      ? 'com.wimpex.app://auth-callback'
      : window.location.origin;
    const nextUrl = `https://id.wimpy-corp.com.ng/login?redirect=${encodeURIComponent(redirect)}`;
    setRedirectUrl(nextUrl);
    window.location.href = nextUrl;
  }, []);

  return (
    <main className="min-h-screen bg-panel text-ivory">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-md border border-hairline bg-panel-2/95 p-8 text-center shadow-2xl shadow-black/40 sm:p-10">
          <p className="text-sm uppercase tracking-[0.32em] text-gold">Sign in</p>
          <h1 className="mt-3 text-3xl font-semibold text-ivory">Redirecting to WimpyID…</h1>
          <p className="mt-4 text-slate">If you are not redirected automatically, please use the button below.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a className="inline-flex rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-6 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110" href={redirectUrl || 'https://id.wimpy-corp.com.ng/login'}>
              Continue to WimpyID
            </a>
            <Link className="inline-flex rounded-2xl border border-hairline px-6 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/10" href="/signup">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}