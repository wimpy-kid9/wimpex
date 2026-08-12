"use client";

import MessageList from './MessageList';

export default function MessagesPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-hairline bg-panel/80 p-8 shadow-2xl shadow-black/10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold">Messages</p>
              <h1 className="mt-3 text-5xl font-semibold text-ivory">A cleaner inbox for every conversation</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate">
                See your most recent chats, manage incoming requests, and start new conversations with a refreshed messaging workspace built for speed and focus.
              </p>
            </div>
            <div className="rounded-3xl border border-hairline bg-panel-2/70 p-6 text-sm text-slate">
              <p className="font-semibold text-ivory">Pro tip</p>
              <p className="mt-3">Use the search field to locate connections quickly, then compose messages from the right-hand panel for faster replies.</p>
            </div>
          </div>
        </section>

        <MessageList />
      </div>
    </main>
  );
}
