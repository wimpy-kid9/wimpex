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
      <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl text-ivory">
        <div className="space-y-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gold">Account required</p>
            <h1 className="mt-2 text-3xl font-semibold text-ivory">{title}</h1>
          </div>
          <p className="text-sm leading-7 text-slate">{description}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex rounded-md bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110">
            Log in
          </Link>
          <Link href="/signup" className="inline-flex rounded-md border border-hairline px-5 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/10">
            Sign up
          </Link>
        </div>
      </section>

      <section className="rounded-md border border-hairline bg-panel/70 p-5 text-sm text-slate">
        <p>You can continue browsing public feed content without signing in.</p>
      </section>
    </main>
  );
}
