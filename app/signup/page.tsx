"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SignupPage() {
  const [signupUrl, setSignupUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const redirect = window.location.origin;
    const nextUrl = `https://id.wimpy-corp.com.ng/signup?redirect=${encodeURIComponent(redirect)}`;
    setSignupUrl(nextUrl);
    window.location.href = nextUrl;
  }, []);

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="surface-veil mx-auto max-w-3xl rounded-md border border-hairline bg-panel-2/80 p-8 shadow-2xl shadow-black/30 sm:p-10">
        <p className="text-sm uppercase tracking-[0.32em] text-gold">Create account</p>
        <h1 className="text-display mt-3 text-3xl text-ivory">Join WIMPEX</h1>
        <p className="mt-4 text-slate">This screen is the dedicated signup entry point, while the actual identity handoff still lands through WimpyID.</p>

        <div className="mt-8 rounded-md border border-hairline bg-panel/70 p-5">
          <p className="text-lg font-semibold text-ivory">Continue with WimpyID</p>
          <p className="mt-2 text-sm text-slate">Use the same trusted sign-in flow to create your account and come back here to complete onboarding.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={signupUrl || 'https://id.wimpy-corp.com.ng/signup'} className="rounded-md bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110">
              Continue to WimpyID
            </a>
            <Link href="/login" className="rounded-md border border-hairline px-5 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/10">
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
