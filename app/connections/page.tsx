"use client";

import { useEffect, useState } from 'react';

interface ProfileMatch {
  user_id: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
}

export default function ConnectionsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([]);
  const [message, setMessage] = useState('');

  const loadState = async () => {
    const response = await fetch('/api/connections');
    const payload = await response.json();
    setRequests(payload.requests || []);
    setConnections(payload.connections || []);
  };

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      const response = await fetch(`/api/people?q=${encodeURIComponent(searchTerm)}`);
      const payload = await response.json();
      setSearchResults(payload.people || []);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const sendRequest = async () => {
    const response = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', recipient_id: recipientId })
    });
    const payload = await response.json();
    setMessage(payload.error || 'Request sent');
    setRecipientId('');
    await loadState();
  };

  const respond = async (connectionId: string, action: 'accept' | 'decline') => {
    const response = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, connection_id: connectionId })
    });
    const payload = await response.json();
    setMessage(payload.error || `Request ${action}ed`);
    await loadState();
  };

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-[2rem] bg-slate-900/80 p-6">
        <h1 className="text-display text-3xl text-white">Connections</h1>
        <p className="mt-2 text-sm text-slate-400">Send requests, review incoming invites, and track accepted connections.</p>

        <div className="mt-4 space-y-3">
          <input value={searchTerm} onChange={(event) => {
            setSearchTerm(event.target.value);
            setRecipientId('');
          }} placeholder="Search by username or display name" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100" />
          {searchResults.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
              {searchResults.map((person) => (
                <button key={person.user_id} type="button" onClick={() => {
                  setRecipientId(person.user_id);
                  setSearchTerm(`${person.display_name || person.username} (@${person.username})`);
                  setSearchResults([]);
                }} className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/5">
                  <div>
                    <p className="text-sm font-semibold text-white">{person.display_name || person.username}</p>
                    <p className="text-xs text-slate-400">@{person.username}</p>
                    {person.bio ? <p className="mt-1 text-xs text-slate-500">{person.bio}</p> : null}
                  </div>
                  <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200">Select</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-3">
            <input value={recipientId} readOnly placeholder="Selected recipient id" className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100" />
            <button onClick={sendRequest} className="rounded-2xl bg-gradient-to-r from-amber-400 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">Send request</button>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-amber-200">{message}</p> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface-veil rounded-[2rem] bg-slate-900/80 p-6">
          <h2 className="text-xl font-semibold text-white">Incoming requests</h2>
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                <p className="text-sm text-slate-200">{request.requester_id}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">Pending request</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => respond(request.id, 'accept')} className="rounded-xl bg-gradient-to-r from-amber-400 to-sky-500 px-3 py-2 text-sm font-semibold text-slate-950">Accept</button>
                  <button onClick={() => respond(request.id, 'decline')} className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-slate-950">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-veil rounded-[2rem] bg-slate-900/80 p-6">
          <h2 className="text-xl font-semibold text-white">Accepted connections</h2>
          <div className="mt-4 space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200">
                <p className="font-medium text-white">Connected</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">{connection.requester_id} ↔ {connection.recipient_id}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
