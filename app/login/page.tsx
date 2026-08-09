"use client";

import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const redirect = window.location.origin;
    setRedirectUrl(`https://id.wimpy-corp.com.ng/login?redirect=${encodeURIComponent(redirect)}`);
    window.location.href = `https://id.wimpy-corp.com.ng/login?redirect=${encodeURIComponent(redirect)}`;
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-10 text-center shadow-2xl shadow-slate-950/40">
          <h1 className="text-3xl font-semibold">Redirecting to WimpyID…</h1>
          <p className="mt-4 text-slate-400">If you are not redirected automatically, please click the button below.</p>
          <a
            className="mt-8 inline-flex rounded-2xl bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            href={redirectUrl || 'https://id.wimpy-corp.com.ng/login'}
          >
            Continue to WimpyID
          </a>
        </div>
      </div>
    </main>
  );
}
