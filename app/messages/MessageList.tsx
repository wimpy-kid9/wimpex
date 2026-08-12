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

interface RequestSummary {
  id: string;
  requester_id: string;
  recipient_id: string;
  requester_display_name?: string | null;
  requester_username?: string | null;
  status: string;
  isIncoming: boolean;
  isOutgoing: boolean;
}

export default function MessageList() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [acceptedConnectionIds, setAcceptedConnectionIds] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.previewAt).getTime() - new Date(a.previewAt).getTime()),
    [conversations]
  );

  const loadState = useCallback(async () => {
    const [messagesResponse, connectionsResponse] = await Promise.all([
      authedFetch('/api/messages'),
      authedFetch('/api/connections')
    ]);

    const messagesPayload = await messagesResponse.json();
    if (!messagesResponse.ok) {
      setNotice(messagesPayload.error || 'Unable to load conversations.');
    } else {
      setConversations(messagesPayload.conversations || []);
    }

    const connectionsPayload = await connectionsResponse.json();
    if (!connectionsResponse.ok) {
      setNotice(connectionsPayload.error || 'Unable to load connection state.');
      setRequests([]);
      setAcceptedConnectionIds({});
      setCurrentUserId(null);
    } else {
      setRequests(connectionsPayload.requests || []);
      setCurrentUserId(connectionsPayload.current_user_id || null);
      const acceptedMap: Record<string, boolean> = {};
      (connectionsPayload.connections || []).forEach((connection: any) => {
        if (connection.requester_id) acceptedMap[connection.requester_id] = true;
        if (connection.recipient_id) acceptedMap[connection.recipient_id] = true;
      });
      setAcceptedConnectionIds(acceptedMap);
    }
  }, []);

  useEffect(() => {
    void loadState();
    const es = new EventSource('/api/messages/stream');
    es.addEventListener('update', () => void loadState());
    es.addEventListener('connected', () => void loadState());
    es.onerror = () => {
      es.close();
      // fallback to polling if SSE fails
      const id = window.setInterval(() => void loadState(), 5000);
      (es as any)._pollId = id;
    };
    return () => {
      if ((es as any)._pollId) window.clearInterval((es as any)._pollId);
      es.close();
    };
  }, [loadState]);

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

  const sendConnectionRequest = async (recipientId: string) => {
    setNotice('');
    const response = await authedFetch('/api/connections', {
      method: 'POST',
      body: JSON.stringify({ action: 'send', recipient_id: recipientId })
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error || 'Unable to send chat request.');
      return;
    }

    setNotice('Chat request sent.');
    await loadState();
  };

  const respondToRequest = async (connectionId: string, action: 'accept' | 'decline') => {
    setNotice('');
    const response = await authedFetch('/api/connections', {
      method: 'POST',
      body: JSON.stringify({ action, connection_id: connectionId })
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error || `Unable to ${action} request.`);
      return;
    }

    setNotice(`Request ${action}ed.`);
    await loadState();
  };

  const pendingByUserId = useMemo(() => {
    const map: Record<string, { id: string; isIncoming: boolean; isOutgoing: boolean }> = {};
    requests.forEach((request) => {
      const otherId = request.isIncoming ? request.requester_id : request.recipient_id;
      if (otherId) {
        map[otherId] = {
          id: request.id,
          isIncoming: request.isIncoming,
          isOutgoing: request.isOutgoing
        };
      }
    });
    return map;
  }, [requests]);

  const handleSearchResultClick = async (person: ProfileMatch) => {
    setNotice('');
    if (!person.user_id || person.user_id === currentUserId) return;

    const isConnected = acceptedConnectionIds[person.user_id];
    const pending = pendingByUserId[person.user_id];

    if (!isConnected) {
      if (pending?.isOutgoing) {
        setNotice(`Request to @${person.username} is pending.`);
        return;
      }

      if (pending?.isIncoming) {
        setNotice(`Accept the incoming request from @${person.username} to chat.`);
        return;
      }

      setNotice(`Send a chat request to @${person.username} first.`);
      return;
    }

    await openChatWithPerson(person);
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
            {searchResults.map((person) => {
              const pending = pendingByUserId[person.user_id];
              const isConnected = acceptedConnectionIds[person.user_id];

              return (
                <div
                  key={person.user_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleSearchResultClick(person)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSearchResultClick(person);
                  }}
                  className="group flex w-full items-center justify-between rounded-3xl border border-hairline bg-panel/80 px-4 py-4 transition hover:border-gold hover:bg-panel-2 focus:outline-none focus:ring-2 focus:ring-gold/30"
                >
                  <div className="flex items-center gap-4">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt={person.display_name || person.username} className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-panel-2 text-xl text-slate">
                        {person.display_name?.charAt(0)?.toUpperCase() || person.username?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ivory">{person.display_name || person.username}</p>
                      <p className="mt-1 truncate text-sm text-slate">@{person.username}</p>
                      {person.bio ? <p className="mt-2 text-xs text-slate line-clamp-2">{person.bio}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {person.user_id !== currentUserId ? (
                      isConnected ? (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Connected</span>
                      ) : pending?.isIncoming ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void respondToRequest(pending.id, 'accept');
                          }}
                          className="rounded-full border border-gold bg-gold/10 px-3 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20"
                        >
                          Accept
                        </button>
                      ) : pending?.isOutgoing ? (
                        <span className="rounded-full bg-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">Requested</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void sendConnectionRequest(person.user_id);
                          }}
                          className="rounded-full border border-ivory/20 bg-ivory/5 px-3 py-2 text-sm font-semibold text-ivory transition hover:bg-panel-2"
                          title="Send chat request"
                        >
                          📩
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {(requests.length > 0) ? (
        <section className="rounded-3xl border border-hairline bg-panel-2/70 p-5">
          <div className="mb-4 text-sm uppercase tracking-[0.28em] text-gold">Chat requests</div>
          <div className="space-y-4">
            {requests.filter((request) => request.isIncoming).map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-3xl border border-hairline bg-panel/80 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-ivory">{request.requester_display_name || request.requester_username || 'Unknown user'}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate">Incoming chat request</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void respondToRequest(request.id, 'accept')}
                    className="rounded-full border border-gold bg-gold/10 px-3 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToRequest(request.id, 'decline')}
                    className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
            {requests.filter((request) => request.isOutgoing).length > 0 ? (
              <div className="rounded-3xl border border-hairline bg-panel/80 px-4 py-4">
                <p className="text-sm font-semibold text-ivory">Outgoing chat requests</p>
                <div className="mt-3 space-y-2">
                  {requests.filter((request) => request.isOutgoing).map((request) => (
                    <div key={request.id} className="flex items-center justify-between rounded-2xl bg-panel-900 px-3 py-3 text-sm text-slate">
                      <span>{request.requester_display_name || request.requester_username || 'Unknown recipient'}</span>
                      <span className="rounded-full bg-slate-700 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-200">Pending</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
