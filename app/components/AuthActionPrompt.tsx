"use client";

import Link from 'next/link';

interface AuthActionPromptProps {
  title?: string;
  description?: string;
}

export default function AuthActionPrompt({
  title = 'Sign in to continue',
  description = 'You can browse publicly, but this action requires a signed-in WimpyID session.',
}: AuthActionPromptProps) {
  return (
    <main className="space-y-6 py-8">
      <section className="surface-veil rounded-[2rem] bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl text-slate-100">
        <div className="space-y-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Account required</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
          </div>
          <p className="text-sm leading-7 text-slate-400">{description}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex rounded-[1.1rem] bg-gradient-to-r from-amber-400 to-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110">
            Log in
          </Link>
          <Link href="/signup" className="inline-flex rounded-[1.1rem] border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            Sign up
          </Link>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-400">
        <p>You can continue browsing public feed content without signing in.</p>
      </section>
    </main>
  );
}
