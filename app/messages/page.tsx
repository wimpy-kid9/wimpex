"use client";

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

interface ProfileMatch {
  user_id: string;
  username: string;
  display_name: string;
  bio?: string;
}

export default function MessagesPage() {
  const [recipientId, setRecipientId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([]);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [requests, setRequests] = useState<any[]>([]);

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

  const sendMessage = async () => {
    const response = await authedFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId, body })
    });
    const payload = await response.json();
    setMessage(payload.error || 'Message sent');
    setBody('');
  };

  useEffect(() => {
    void authedFetch('/api/messages').then(async (response) => {
      const payload = await response.json();
      if (payload.error) {
        setMessage(payload.error);
      }
    });

    const loadRequests = async () => {
      const resp = await authedFetch('/api/connections');
      const payload = await resp.json();
      setRequests(payload.requests || []);
    };
    void loadRequests();
  }, []);

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-[2rem] bg-slate-900/80 p-6">
        <h1 className="text-display text-3xl text-white">Messages</h1>
        <p className="mt-2 text-sm text-slate-400">Open a direct thread with an accepted connection.</p>

        <div className="mt-4 space-y-3">
          <div className="flex gap-3 mb-3">
            <button onClick={() => setActiveTab('chats')} className={`px-3 py-2 rounded-2xl ${activeTab === 'chats' ? 'bg-amber-400/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>Chats</button>
            <button onClick={() => setActiveTab('requests')} className={`px-3 py-2 rounded-2xl ${activeTab === 'requests' ? 'bg-amber-400/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>Requests</button>
          </div>

          {activeTab === 'requests' ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
              {requests.length > 0 ? requests.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 mb-2">
                  <p className="font-medium text-white">{r.requester_id}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={async () => {
                      await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify({ action: 'accept', connection_id: r.id }) });
                      setRequests((cur) => cur.filter((x) => x.id !== r.id));
                    }} className="rounded-xl bg-gradient-to-r from-amber-400 to-sky-500 px-3 py-2 text-sm font-semibold text-slate-950">Accept</button>
                    <button onClick={async () => {
                      await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify({ action: 'decline', connection_id: r.id }) });
                      setRequests((cur) => cur.filter((x) => x.id !== r.id));
                    }} className="rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-slate-950">Decline</button>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400">No requests</p>}
            </div>
          ) : null}
          <input value={searchTerm} onChange={(event) => {
            setSearchTerm(event.target.value);
            setRecipientId('');
          }} placeholder="Search a connection by username or display name" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100" />
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
          <input value={recipientId} readOnly placeholder="Selected recipient id" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100" />
          <button onClick={sendMessage} className="rounded-2xl bg-gradient-to-r from-amber-400 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">Send message</button>
          {message ? <p className="text-sm text-amber-200">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
