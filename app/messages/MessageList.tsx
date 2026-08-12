"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<ProfileMatch | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [requests, setRequests] = useState<any[]>([]);
  const [groupRecipients, setGroupRecipients] = useState<ProfileMatch[]>([]);

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.previewAt).getTime() - new Date(a.previewAt).getTime()),
    [conversations]
  );

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

  useEffect(() => {
    if (searchParams.get('compose') === '1') {
      setActiveTab('chats');
      searchInputRef.current?.focus();
    }
  }, [searchParams]);

  const selectRecipient = (person: ProfileMatch) => {
    setSelectedRecipient(person);
    setSearchTerm(`${person.display_name || person.username} (@${person.username})`);
    setSearchResults([]);
  };

  const addGroupRecipient = (person: ProfileMatch) => {
    setGroupRecipients((current) => {
      if (current.some((recipient) => recipient.user_id === person.user_id)) {
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

    const formData = new FormData();
    formData.append('body', draft.trim());

    if (groupRecipients.length > 0) {
      formData.append('recipient_ids', JSON.stringify(groupRecipients.map((recipient) => recipient.user_id)));
      if (groupRecipients.length > 1) {
        formData.append('title', `Group with ${groupRecipients.length + 1}`);
      }
    } else if (selectedRecipient) {
      formData.append('recipient_id', selectedRecipient.user_id);
    } else {
      setNotice('Select a recipient to start a conversation.');
      return;
    }

    const response = await authedFetch('/api/messages', {
      method: 'POST',
      body: formData,
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
    <main className="space-y-6">
      <section className="rounded-[2rem] border border-hairline bg-panel/80 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-gold">Messages</p>
            <h2 className="mt-3 text-3xl font-semibold text-ivory">Search, manage requests, and compose in one place.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">A modern messaging workspace for quick replies and polished thread management.</p>
          </div>
          <div className="rounded-3xl border border-hairline bg-panel-2/70 p-5 text-sm text-slate">
            <p className="font-semibold text-ivory">Need a quick start?</p>
            <p className="mt-3">Search for a connection, preview recent threads, then send a message from the composer panel.</p>
          </div>
        </div>
      </section>

      {notice ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{notice}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-hairline bg-panel-2/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-gold">Search</p>
                <h3 className="mt-2 text-2xl font-semibold text-ivory">Find a connection</h3>
              </div>
              <span className="rounded-full bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-gold">{sortedConversations.length} active chats</span>
            </div>
            <div className="mt-5">
              <input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSelectedRecipient(null);
                }}
                placeholder="Search by username or display name"
                className="w-full rounded-3xl border border-hairline bg-panel px-4 py-4 text-sm text-ivory outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              {searchResults.length > 0 ? (
                <div className="mt-4 space-y-3">
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
                      className="w-full rounded-3xl border border-hairline bg-panel/80 px-4 py-4 text-left text-sm text-ivory transition hover:border-gold hover:bg-panel-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{person.display_name || person.username}</p>
                          <p className="text-xs text-slate">@{person.username}</p>
                        </div>
                        <span className="rounded-full bg-gold/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-gold">
                          {groupRecipients.length > 0 ? 'Add' : 'Select'}
                        </span>
                      </div>
                      {person.bio ? <p className="mt-2 text-xs text-slate">{person.bio}</p> : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {groupRecipients.length > 0 ? (
                <div className="mt-4 rounded-3xl border border-hairline bg-panel/80 p-4 text-sm text-ivory">
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
          </div>

          <div className="rounded-3xl border border-hairline bg-panel-2/70 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-gold">Conversation feed</p>
                <h3 className="mt-2 text-2xl font-semibold text-ivory">Recent chats</h3>
              </div>
              <span className="rounded-full bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-gold">Tap to open</span>
            </div>
            <div className="mt-5 space-y-4">
              {sortedConversations.length > 0 ? sortedConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="block rounded-3xl border border-hairline bg-panel/80 px-4 py-4 transition hover:border-gold hover:bg-panel-2"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-panel-2 text-center leading-[3.5rem] text-xl text-slate">
                      {conversation.otherUser?.display_name?.charAt(0)?.toUpperCase() || conversation.otherUser?.username?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-lg font-semibold text-ivory">{conversation.title || conversation.otherUser?.display_name || conversation.otherUser?.username || 'Unknown chat'}</p>
                        <span className="text-xs uppercase tracking-[0.24em] text-slate">{new Date(conversation.previewAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 truncate text-sm text-slate">{conversation.previewSentByMe ? 'You: ' : ''}{conversation.preview}</p>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="rounded-3xl border border-dashed border-hairline bg-panel-70 p-6 text-center text-sm text-slate">
                  No conversations yet. Search a connection to start a chat.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6 rounded-3xl border border-hairline bg-panel/80 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gold">Composer</p>
            <h3 className="mt-2 text-2xl font-semibold text-ivory">Send a message</h3>
            <p className="mt-2 text-sm leading-6 text-slate">Select a contact or group, draft your message, and send instantly.</p>
          </div>
          <div className="rounded-3xl border border-hairline bg-panel-2/70 p-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate">To</label>
              <div className="min-h-[56px] rounded-2xl border border-hairline bg-panel px-4 py-3 text-sm text-ivory">
                {groupRecipients.length > 0
                  ? `${groupRecipients.length} recipients selected`
                  : selectedRecipient
                    ? `${selectedRecipient.display_name || selectedRecipient.username} (@${selectedRecipient.username})`
                    : 'Choose someone from search'}
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate">Message</label>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write your message…"
                className="min-h-[180px] w-full rounded-3xl border border-hairline bg-panel px-4 py-4 text-sm text-ivory outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <button onClick={sendMessage} className="mt-5 w-full rounded-3xl bg-gradient-to-r from-gold to-gold-deep px-5 py-4 text-sm font-semibold text-obsidian transition hover:brightness-110">
              Send message
            </button>
            <p className="mt-3 text-xs text-slate">Tip: you can search first and then send directly from this composer.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
