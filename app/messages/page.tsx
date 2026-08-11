"use client";

import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

interface ProfileMatch {
  user_id: string;
  username: string;
  display_name: string;
  bio?: string;
}

interface ConversationSummary {
  id: string;
  title?: string;
  participantCount?: number;
  isGroup?: boolean;
  preview: string;
  previewSentByMe: boolean;
  previewAt: string;
  otherUser?: {
    user_id: string | null;
    username: string;
    display_name: string;
    avatar_url?: string | null;
  };
}

interface Message {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  media_type?: string;
  media_url?: string;
}

export default function MessagesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileMatch[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<ProfileMatch | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'requests'>('chats');
  const [requests, setRequests] = useState<any[]>([]);
  const [groupRecipients, setGroupRecipients] = useState<ProfileMatch[]>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

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

  const loadMessages = async (conversationId: string) => {
    const response = await authedFetch(`/api/messages?conversation_id=${encodeURIComponent(conversationId)}`);
    const payload = await response.json();
    if (!response.ok) {
      setNotice(payload.error || 'Unable to load messages.');
      return;
    }
    setMessages(payload.messages || []);
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

  const setAttachmentFile = (file: File | null) => {
    setAttachment(file);
  };

  const stopRecording = () => {
    recorder?.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice('Recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        setAttachment(file);
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setRecording(true);
      setNotice('Recording voice note...');
    } catch (error) {
      setNotice('Unable to access microphone.');
    }
  };

  const openConversation = async (conversation: ConversationSummary) => {
    setActiveConversation(conversation);
    setDraft('');
    await loadMessages(conversation.id);
  };

  const sendMessage = async () => {
    if (!draft.trim()) {
      setNotice('Please type a message.');
      return;
    }

    const payloadBody: any = { body: draft.trim() };
    if (activeConversation?.id) {
      payloadBody.conversation_id = activeConversation.id;
    } else if (groupRecipients.length > 0) {
      payloadBody.recipient_ids = groupRecipients.map((recipient) => recipient.user_id);
      payloadBody.title = groupRecipients.length > 1 ? `Group with ${groupRecipients.length + 1}` : undefined;
    } else if (selectedRecipient) {
      payloadBody.recipient_id = selectedRecipient.user_id;
    } else {
      setNotice('Select a recipient or open a conversation first.');
      return;
    }

    const formData = new FormData();
    formData.append('body', draft.trim());
    if (payloadBody.conversation_id) {
      formData.append('conversation_id', payloadBody.conversation_id);
    }
    if (payloadBody.recipient_ids) {
      formData.append('recipient_ids', JSON.stringify(payloadBody.recipient_ids));
    }
    if (payloadBody.recipient_id) {
      formData.append('recipient_id', payloadBody.recipient_id);
    }
    if (payloadBody.title) {
      formData.append('title', payloadBody.title);
    }
    if (attachment) {
      formData.append('media', attachment);
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
    setAttachment(null);
    setRecording(false);
    await loadConversations();
    if (payload.conversation?.id) {
      await openConversation({
        ...activeConversation,
        id: payload.conversation.id,
        otherUser: selectedRecipient || activeConversation?.otherUser || { user_id: null, username: '', display_name: '' },
        title: payload.conversation.title || activeConversation?.title
      } as ConversationSummary);
    }
  };

  return (
    <main className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
      <section className="space-y-4 rounded-[2rem] border border-white/10 bg-slate-950/80 p-6">
        <div>
          <h1 className="text-display text-3xl text-white">Messages</h1>
          <p className="mt-2 text-sm text-slate-400">Conversations and direct threads with your accepted connections.</p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setActiveTab('chats')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${activeTab === 'chats' ? 'bg-amber-400/20 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Chats</button>
          <button onClick={() => setActiveTab('requests')} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${activeTab === 'requests' ? 'bg-amber-400/20 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>Requests</button>
        </div>

        {activeTab === 'requests' ? (
          <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/70 p-4">
            {requests.length > 0 ? requests.map((request) => (
              <div key={request.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                <p className="font-semibold text-white">Connection request from {request.requester_id}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify({ action: 'accept', connection_id: request.id }) });
                      setRequests((cur) => cur.filter((item) => item.id !== request.id));
                    }}
                    className="rounded-2xl bg-gradient-to-r from-amber-400 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      await authedFetch('/api/connections', { method: 'POST', body: JSON.stringify({ action: 'decline', connection_id: request.id }) });
                      setRequests((cur) => cur.filter((item) => item.id !== request.id));
                    }}
                    className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )) : (
              <p className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">No connection requests at the moment.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
              <label className="text-sm text-slate-400">Search connections</label>
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSelectedRecipient(null);
                }}
                placeholder="Search by username or display name"
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
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
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-left text-sm text-white transition hover:border-amber-400/40 hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{person.display_name || person.username}</p>
                          <p className="text-xs text-slate-400">@{person.username}</p>
                          {person.bio ? <p className="mt-1 text-xs text-slate-500">{person.bio}</p> : null}
                        </div>
                        <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200">
                          {groupRecipients.length > 0 ? 'Add' : 'Select'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {groupRecipients.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Group recipients</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {groupRecipients.map((recipient) => (
                      <span key={recipient.user_id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                        {recipient.display_name || recipient.username}
                        <button type="button" onClick={() => removeGroupRecipient(recipient.user_id)} className="rounded-full bg-rose-500/20 px-2 py-1 text-xs text-rose-200">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
              <h2 className="text-sm font-semibold text-white">Conversations</h2>
              <div className="mt-4 space-y-3">
                {sortedConversations.length > 0 ? sortedConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => openConversation(conversation)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${activeConversation?.id === conversation.id ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-slate-950/80 hover:border-white/20 hover:bg-slate-900'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{conversation.otherUser?.display_name || conversation.otherUser?.username || 'Unknown user'}</p>
                        <p className="text-xs text-slate-400">@{conversation.otherUser?.username || 'unknown'}</p>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{new Date(conversation.previewAt).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{conversation.previewSentByMe ? 'You: ' : ''}{conversation.preview}</p>
                  </button>
                )) : (
                  <p className="text-sm text-slate-400">No conversations yet. Search for a connection to start one.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Thread</p>
            <h2 className="text-2xl font-semibold text-white">
              {activeConversation
                ? `Chat with ${activeConversation.otherUser?.display_name || activeConversation.otherUser?.username || 'Unknown user'}`
                : 'Select a conversation'}
            </h2>
          </div>
        </div>

        {notice ? <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{notice}</p> : null}

        <div className="mt-6 space-y-3">
          {messages.length > 0 ? messages.map((messageItem) => (
            <div key={messageItem.id} className={`rounded-3xl p-4 ${messageItem.sender_id === activeConversation?.otherUser?.user_id ? 'bg-slate-900/80 text-slate-100' : 'bg-amber-400/10 text-slate-100'}`}>
              <div className="space-y-3">
                {messageItem.body ? <p className="text-sm leading-7">{messageItem.body}</p> : null}
                {messageItem.media_url ? (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-3">
                    {messageItem.media_type?.startsWith('image') ? (
                      <img src={messageItem.media_url} alt="Attachment" className="w-full rounded-2xl object-cover" />
                    ) : messageItem.media_type?.startsWith('video') ? (
                      <video controls src={messageItem.media_url} className="w-full rounded-2xl object-cover" />
                    ) : (
                      <audio controls src={messageItem.media_url} className="w-full" />
                    )}
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-slate-500">{new Date(messageItem.created_at).toLocaleString()}</p>
            </div>
          )) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">Select a conversation or search a connection to begin messaging.</div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <div>
            <label className="text-sm text-slate-400">New message</label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write your message"
              className="mt-3 min-h-[140px] w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-sm text-slate-400">Attachments</p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white transition hover:bg-white/5">
                  <span>Choose file</span>
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className="rounded-2xl bg-gradient-to-r from-amber-400 to-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                >
                  {recording ? 'Stop recording' : 'Record voice note'}
                </button>
              </div>
              {attachment ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-slate-200">
                  <p>Attached: {attachment.name}</p>
                  <button type="button" onClick={() => setAttachmentFile(null)} className="mt-2 inline-flex rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">Remove</button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col justify-between gap-3">
              <div className="text-sm text-slate-400">
                {groupRecipients.length > 0
                  ? `Group message to ${groupRecipients.length + 1}`
                  : selectedRecipient
                  ? `Sending to ${selectedRecipient.display_name || selectedRecipient.username}`
                  : activeConversation
                  ? `Active thread with ${activeConversation.otherUser?.display_name || activeConversation.otherUser?.username}`
                  : 'Pick a recipient to start.'}
              </div>
              <button onClick={sendMessage} className="rounded-2xl bg-gradient-to-r from-amber-400 to-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110">Send</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
