"use client";

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
  unreadCount?: number;
}

export default function MessageList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [notice, setNotice] = useState('');

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.previewAt).getTime() - new Date(a.previewAt).getTime()),
    [conversations]
  );

  useEffect(() => {
    const loadConversations = async () => {
      const response = await authedFetch('/api/messages');
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || 'Unable to load conversations.');
        return;
      }
      setConversations(payload.conversations || []);
    };

    void loadConversations();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      const response = await authedFetch(`/api/people?q=${encodeURIComponent(searchTerm)}`);
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || 'Search failed.');
        setSearchResults([]);
        return;
      }
      setSearchResults(payload.people || []);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const openConversation = (conversationId: string) => {
    router.push(`/messages/${conversationId}`);
  };

  const openChatWithPerson = async (person: ProfileMatch) => {
    setNotice('');
    const response = await authedFetch(`/api/messages?participant_id=${encodeURIComponent(person.user_id)}`);
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error || 'Unable to open this chat.');
      return;
    }

    if (payload.conversation?.id) {
      router.push(`/messages/${payload.conversation.id}`);
      return;
    }

    setNotice('Unable to start a new chat.');
  };

  return (
    <main className="space-y-6">
      {notice ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{notice}</div>
      ) : null}

      <section className="rounded-3xl border border-hairline bg-panel-2/70 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-gold">Messages</p>
            <h1 className="mt-3 text-3xl font-semibold text-ivory">Inbox</h1>
          </div>
          <span className="rounded-full bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-gold">{sortedConversations.length} chats</span>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-slate">Search connections</label>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by username or display name"
            className="w-full rounded-3xl border border-hairline bg-panel px-4 py-3 text-sm text-ivory outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>
      </section>

      {searchResults.length > 0 ? (
        <section className="rounded-3xl border border-hairline bg-panel-2/70 p-5">
          <div className="mb-4 text-sm uppercase tracking-[0.28em] text-gold">Search results</div>
          <div className="space-y-3">
            {searchResults.map((person) => (
              <button
                key={person.user_id}
                type="button"
                onClick={() => void openChatWithPerson(person)}
                className="w-full rounded-3xl border border-hairline bg-panel/80 px-4 py-4 text-left transition hover:border-gold hover:bg-panel-2"
              >
                <div className="flex items-center gap-4">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt={person.display_name || person.username} className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-panel-2 text-xl text-slate">
                      {person.display_name?.charAt(0)?.toUpperCase() || person.username?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ivory">{person.display_name || person.username}</p>
                    <p className="mt-1 truncate text-sm text-slate">@{person.username}</p>
                    {person.bio ? <p className="mt-2 text-xs text-slate line-clamp-2">{person.bio}</p> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {sortedConversations.length > 0 ? (
          sortedConversations.map((conversation) => {
            const other = conversation.otherUser;
            const timeLabel = new Date(conversation.previewAt).toLocaleDateString();
            const initials = other?.display_name?.charAt(0)?.toUpperCase() || other?.username?.charAt(0)?.toUpperCase() || 'C';

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => openConversation(conversation.id)}
                className="group flex w-full items-start gap-4 rounded-3xl border border-hairline bg-panel-2/70 px-4 py-4 text-left transition hover:border-gold hover:bg-panel/80"
              >
                {other?.avatar_url ? (
                  <img src={other.avatar_url} alt={other.display_name || other.username} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-panel-2 text-xl text-slate">{initials}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-ivory">{conversation.title || other?.display_name || other?.username || 'Unknown chat'}</p>
                      <p className="mt-2 truncate text-sm text-slate">{conversation.previewSentByMe ? 'You: ' : ''}{conversation.preview}</p>
                    </div>
                    <p className="whitespace-nowrap text-xs uppercase tracking-[0.24em] text-slate">{timeLabel}</p>
                  </div>
                  {typeof conversation.unreadCount === 'number' && conversation.unreadCount > 0 ? (
                    <div className="mt-4 flex justify-end">
                      <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-obsidian">{conversation.unreadCount}</span>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-hairline bg-panel-2/70 p-6 text-center text-sm text-slate">
            No conversations yet. Search for a connection to start a chat.
          </div>
        )}
      </section>
    </main>
  );
}
