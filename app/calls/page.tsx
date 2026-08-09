"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CallsPage() {
  const [calls, setCalls] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } | null }) => {
      setSession(result?.data?.session ?? null);
    });
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;

    fetch('/api/calls', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })
      .then((response) => response.json())
      .then((payload) => setCalls(payload.calls ?? []))
      .catch(() => setCalls([]));
  }, [session]);

  return (
    <main className="space-y-6 p-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 text-slate-100">
        <h1 className="text-display text-3xl text-white">Calls</h1>
        <p className="mt-2 text-sm text-slate-400">The first pass of the calling UX is now wired to the shared calls table.</p>
      </section>
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-slate-100">
        <h2 className="text-xl font-semibold text-white">Recent calls</h2>
        {calls.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No calls recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {calls.map((call) => (
              <li key={call.id} className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                <p className="font-medium text-white">{call.call_type} call • {call.status}</p>
                <p className="mt-1 text-slate-400">Room: {call.room_id || 'pending'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
