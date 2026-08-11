"use client";

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

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
    const response = await authedFetch('/api/connections');
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

      const response = await authedFetch(`/api/people?q=${encodeURIComponent(searchTerm)}`);
      const payload = await response.json();
      setSearchResults(payload.people || []);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const sendRequest = async () => {
    const response = await authedFetch('/api/connections', {
      method: 'POST',
      body: JSON.stringify({ action: 'send', recipient_id: recipientId })
    });
    const payload = await response.json();
    setMessage(payload.error || 'Request sent');
    setRecipientId('');
    await loadState();
  };

  const respond = async (connectionId: string, action: 'accept' | 'decline') => {
    const response = await authedFetch('/api/connections', {
      method: 'POST',
      body: JSON.stringify({ action, connection_id: connectionId })
    });
    const payload = await response.json();
    setMessage(payload.error || `Request ${action}ed`);
    await loadState();
  };

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-md bg-panel-2/80 p-6">
        <h1 className="text-display text-3xl text-ivory">Connections</h1>
        <p className="mt-2 text-sm text-slate">Send requests, review incoming invites, and track accepted connections.</p>

        <div className="mt-4 space-y-3">
          <input value={searchTerm} onChange={(event) => {
            setSearchTerm(event.target.value);
            setRecipientId('');
          }} placeholder="Search by username or display name" className="w-full rounded-2xl border border-hairline bg-panel/70 px-4 py-2 text-sm text-ivory" />
          {searchResults.length > 0 ? (
            <div className="rounded-2xl border border-hairline bg-panel/70 p-3">
              {searchResults.map((person) => (
                <button key={person.user_id} type="button" onClick={() => {
                  setRecipientId(person.user_id);
                  setSearchTerm(`${person.display_name || person.username} (@${person.username})`);
                  setSearchResults([]);
                }} className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-ivory/5">
                  <div>
                    <p className="text-sm font-semibold text-ivory">{person.display_name || person.username}</p>
                    <p className="text-xs text-slate">@{person.username}</p>
                    {person.bio ? <p className="mt-1 text-xs text-slate">{person.bio}</p> : null}
                  </div>
                  <span className="rounded-full bg-gold/10 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-gold">Select</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-3">
            <input value={recipientId} readOnly placeholder="Selected recipient id" className="flex-1 rounded-2xl border border-hairline bg-panel/70 px-4 py-2 text-sm text-ivory" />
            <button onClick={sendRequest} className="rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-4 py-2 text-sm font-semibold text-obsidian">Send request</button>
          </div>
        </div>
        {message ? <p className="mt-3 text-sm text-gold">{message}</p> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface-veil rounded-md bg-panel-2/80 p-6">
          <h2 className="text-xl font-semibold text-ivory">Incoming requests</h2>
          <div className="mt-4 space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-hairline bg-panel/70 p-3">
                <p className="text-sm text-ivory">{request.requester_id}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate">Pending request</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => respond(request.id, 'accept')} className="rounded-xl bg-gradient-to-r from-gold to-gold-deep px-3 py-2 text-sm font-semibold text-obsidian">Accept</button>
                  <button onClick={() => respond(request.id, 'decline')} className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-obsidian">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-veil rounded-md bg-panel-2/80 p-6">
          <h2 className="text-xl font-semibold text-ivory">Accepted connections</h2>
          <div className="mt-4 space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="rounded-2xl border border-hairline bg-panel/70 p-3 text-sm text-ivory">
                <p className="font-medium text-ivory">Connected</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate">{connection.requester_id} ↔ {connection.recipient_id}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
