'use client';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-obsidian px-6 text-ivory">
      <section className="w-full max-w-md rounded-3xl border border-hairline bg-panel-2/80 p-8 text-center shadow-2xl">
        <img src="/wimpex-logo.png" alt="Wimpex logo" className="mx-auto h-20 w-20 rounded-3xl object-cover" />
        <p className="mt-6 text-xs uppercase tracking-[0.32em] text-gold">WIMPEX</p>
        <h1 className="mt-3 text-3xl font-semibold">You&apos;re offline</h1>
        <p className="mt-3 text-sm leading-6 text-slate">Welcome back. Reconnect to keep going and load the latest content.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-obsidian transition hover:bg-gold-deep">
          Retry connection
        </button>
      </section>
    </main>
  );
}
