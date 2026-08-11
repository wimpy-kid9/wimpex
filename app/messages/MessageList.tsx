"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';

interface ProfileMatch {
  user_id: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string | null;
}

interface ConversationSummary {
  id: string;
  title?: string;
  participantCount?: number;
  preview: string;
  previewSentByMe: boolean;
  previewAt: string;
  isGroup?: boolean;
  otherUser?: {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
  } | null;
}

export default function MessageList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<ProfileMatch | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [requests, setRequests] = useState<any[]>([]);
  const [groupRecipients, setGroupRecipients] = useState<ProfileMatch[]>([]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => new Date(b.previewAt).getTime() - new Date(a.previewAt).getTime());
  }, [conversations]);

  const loadConversations = async () => {
    const response = await authedFetch('/api/messages');
    const payload = await response.json();
    if (!response.ok) {
      setNotice(payload.error || 'Unable to load conversations.');
      return;
    }
    setConversations(payload.conversations || []);
  };

  const loadRequests = async () => {
    const resp = await authedFetch('/api/connections');
    const payload = await resp.json();
    setRequests(payload.requests || []);
  };

  useEffect(() => {
    void loadConversations();
    void loadRequests();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      const response = await authedFetch(`/api/people?q=${encodeURIComponent(searchTerm)}`);
      const payload = await response.json();
      if (!response.ok) {
        setSearchResults([]);
        setNotice(payload.error || 'Search failed.');
        return;
      }
      setSearchResults(payload.people || []);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const selectRecipient = (person: ProfileMatch) => {
    setSelectedRecipient(person);
    setSearchTerm(`${person.display_name || person.username} (@${person.username})`);
    setSearchResults([]);
  };

  const addGroupRecipient = (person: ProfileMatch) => {
    setGroupRecipients((current) => {
      if (current.find((recipient) => recipient.user_id === person.user_id)) {
        return current;
      }
      return [...current, person];
    });
    setSelectedRecipient(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeGroupRecipient = (userId: string) => {
    setGroupRecipients((current) => current.filter((recipient) => recipient.user_id !== userId));
  };

  const sendMessage = async () => {
    if (!draft.trim()) {
      setNotice('Please type a message.');
      return;
    }

    const payloadBody: any = { body: draft.trim() };

    if (groupRecipients.length > 0) {
      payloadBody.recipient_ids = groupRecipients.map((recipient) => recipient.user_id);
      payloadBody.title = groupRecipients.length > 1 ? `Group with ${groupRecipients.length + 1}` : undefined;
    } else if (selectedRecipient) {
      payloadBody.recipient_id = selectedRecipient.user_id;
    } else {
      setNotice('Select a recipient to start a conversation.');
      return;
    }

    const formData = new FormData();
    formData.append('body', draft.trim());
    if (payloadBody.recipient_ids) {
      formData.append('recipient_ids', JSON.stringify(payloadBody.recipient_ids));
    }
    if (payloadBody.recipient_id) {
      formData.append('recipient_id', payloadBody.recipient_id);
    }
    if (payloadBody.title) {
      formData.append('title', payloadBody.title);
    }

    const response = await authedFetch('/api/messages', {
      method: 'POST',
      body: formData
    });
    const payload = await response.json();
    if (!response.ok) {
      setNotice(payload.error || 'Message send failed.');
      return;
    }

    setNotice('Message sent.');
    setDraft('');
    setGroupRecipients([]);
    setSelectedRecipient(null);
    await loadConversations();
    if (payload.conversation?.id) {
      router.push(`/messages/${payload.conversation.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-hairline bg-panel/80 p-6">
        <div>
          <h1 className="text-display text-3xl text-ivory">Messages</h1>
          <p className="mt-2 text-sm text-slate">Start a conversation with your accepted connections.</p>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => setActiveTab('chats')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${activeTab === 'chats' ? 'bg-gold/20 text-ivory' : 'bg-ivory/5 text-slate hover:bg-ivory/10'}`}>Chats</button>
          <button onClick={() => setActiveTab('requests')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${activeTab === 'requests' ? 'bg-gold/20 text-ivory' : 'bg-ivory/5 text-slate hover:bg-ivory/10'}`}>Requests</button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <div className="space-y-3 rounded-3xl border border-hairline bg-panel-2/70 p-4">
          {requests.length > 0 ? requests.map((request) => (
            <div key={request.id} className="rounded-3xl border border-hairline bg-panel/80 p-4">
              <p className="font-semibold text-ivory">
                {request.requester_display_name || request.requester_username ? (
                  <>Connection request from <span className="text-gold">{request.requester_display_name || request.requester_username}</span></>
                ) : (
                  <Link href={`/user/${request.requester_id}`} className="underline">Connection request</Link>
                )}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate">Pending connection request</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    const resp = await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify({ action: 'accept', connection_id: request.id }) });
                    setRequests((cur) => cur.filter((item) => item.id !== request.id));
                    if (resp.ok) {
                      const createResp = await authedFetch('/api/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipient_id: request.requester_id, body: 'Connection accepted — hi!' })
                      });
                      const created = await createResp.json().catch(() => ({}));
                      if (createResp.ok && created.conversation?.id) {
                        router.push(`/messages/${created.conversation.id}`);
                      }
                    }
                  }}
                  className="rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-4 py-2 text-sm font-semibold text-obsidian"
                >
                  Accept
                </button>
                <button
                  onClick={async () => {
                    await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify({ action: 'decline', connection_id: request.id }) });
                    setRequests((cur) => cur.filter((item) => item.id !== request.id));
                  }}
                  className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-obsidian"
                >
                  Decline
                </button>
                <Link href={`/user/${request.requester_id}`} className="inline-flex items-center justify-center rounded-2xl border border-hairline bg-panel px-4 py-2 text-sm text-ivory">View profile</Link>
                <Link href={`/messages?recipient_id=${request.requester_id}`} className="inline-flex items-center justify-center rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-obsidian">Message</Link>
              </div>
            </div>
          )) : (
            <p className="rounded-2xl border border-dashed border-hairline bg-panel-2/70 p-6 text-sm text-slate">No connection requests at the moment.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border border-hairline bg-panel-2/70 p-4">
            <label className="text-sm text-slate">Search connections</label>
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setSelectedRecipient(null);
              }}
              placeholder="Search by username or display name"
              className="mt-3 w-full rounded-2xl border border-hairline bg-panel/80 px-4 py-3 text-sm text-ivory outline-none focus:border-hairline-strong"
            />
            {searchResults.length > 0 ? (
              <div className="mt-3 space-y-2">
                {searchResults.map((person) => (
                  <button
                    key={person.user_id}
                    type="button"
                    onClick={() => {
                      if (groupRecipients.length > 0) {
                        addGroupRecipient(person);
                      } else {
                        selectRecipient(person);
                      }
                    }}
                    className="w-full rounded-2xl border border-hairline bg-panel/80 px-4 py-3 text-left text-sm text-ivory transition hover:border-hairline-strong hover:bg-panel-2"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{person.display_name || person.username}</p>
                        <p className="text-xs text-slate">@{person.username}</p>
                        {person.bio ? <p className="mt-1 text-xs text-slate">{person.bio}</p> : null}
                      </div>
                      <span className="rounded-full bg-gold/10 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-gold">
                        {groupRecipients.length > 0 ? 'Add' : 'Select'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {groupRecipients.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-hairline bg-panel/80 p-3 text-sm text-ivory">
                <p className="text-xs uppercase tracking-[0.25em] text-slate">Group recipients</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {groupRecipients.map((recipient) => (
                    <span key={recipient.user_id} className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel-2 px-3 py-2 text-sm text-ivory">
                      {recipient.display_name || recipient.username}
                      <button type="button" onClick={() => removeGroupRecipient(recipient.user_id)} className="rounded-full bg-rose-500/20 px-2 py-1 text-xs text-rose-200">×</button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-hairline bg-panel-2/70 p-4">
            <h2 className="text-sm font-semibold text-ivory">Conversations</h2>
            <div className="mt-4 space-y-3">
              {sortedConversations.length > 0 ? sortedConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="w-full block rounded-2xl border border-hairline bg-panel-80 px-4 py-3 text-left transition hover:border-white/20 hover:bg-panel-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {conversation.otherUser?.avatar_url ? (
                        <img src={conversation.otherUser.avatar_url} alt={conversation.otherUser.display_name || conversation.otherUser.username} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-panel-2 text-sm text-slate">
                          {conversation.otherUser?.display_name?.charAt(0)?.toUpperCase() || conversation.otherUser?.username?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-ivory">{conversation.otherUser?.display_name || conversation.otherUser?.username || 'Unknown user'}</p>
                        <p className="text-xs text-slate">@{conversation.otherUser?.username || 'unknown'}</p>
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.25em] text-slate">{new Date(conversation.previewAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate">{conversation.previewSentByMe ? 'You: ' : ''}{conversation.preview}</p>
                </Link>
              )) : (
                <p className="text-sm text-slate">No conversations yet. Search for a connection to start one.</p>
              )}
            </div>
          </div>
        </div>

          <div className="rounded-3xl border border-hairline bg-panel-2/70 p-4">
            <div>
              <label className="text-sm text-slate">New message</label>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message"
                className="mt-3 min-h-[140px] w-full rounded-3xl border border-hairline bg-panel/80 px-4 py-4 text-sm text-ivory outline-none focus:border-hairline-strong"
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3 rounded-3xl border border-hairline bg-panel-2/70 p-4">
                <p className="text-sm text-slate">Attachments</p>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-hairline bg-panel px-4 py-3 text-sm text-ivory transition hover:bg-ivory/5">
                    <span>Choose file</span>
                    <input type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={() => void 0} />
                  </label>
                </div>
                <p className="text-xs text-slate">Attachments are coming soon in the thread composer.</p>
              </div>
              <div className="flex flex-col justify-between gap-3">
                <div className="text-sm text-slate">
                  {groupRecipients.length > 0
                    ? `Group message to ${groupRecipients.length + 1}`
                    : selectedRecipient
                      ? `Sending to ${selectedRecipient.display_name || selectedRecipient.username}`
                      : 'Pick a recipient to start.'}
                </div>
                <button onClick={sendMessage} className="rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{notice}</p> : null}
    </div>
  );
}
