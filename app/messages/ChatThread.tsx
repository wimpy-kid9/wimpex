"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';

interface ChatThreadProps {
  conversationId: string;
  onClose?: () => void;
  showBackButton?: boolean;
}

export default function ChatThread({ conversationId, onClose, showBackButton = false }: ChatThreadProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any | null>(null);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);

  const loadThread = useCallback(async () => {
    const resp = await authedFetch(`/api/messages?conversation_id=${encodeURIComponent(conversationId)}`);
    const payload = await resp.json();
    if (!resp.ok) {
      setNotice(payload.error || 'Unable to load messages.');
      return;
    }
    setMessages(payload.messages || []);
    if (payload.conversation) setConversation(payload.conversation);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void loadThread();
  }, [conversationId, loadThread]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!showBackButton) return;

    const onTouchStart = (event: TouchEvent) => {
      touchStartX.current = event.touches[0]?.clientX ?? null;
      touchCurrentX.current = touchStartX.current;
    };

    const onTouchMove = (event: TouchEvent) => {
      touchCurrentX.current = event.touches[0]?.clientX ?? null;
      if (touchStartX.current !== null && touchCurrentX.current !== null && touchCurrentX.current - touchStartX.current < -40) {
        setIsDragging(true);
      }
    };

    const onTouchEnd = () => {
      if (touchStartX.current !== null && touchCurrentX.current !== null) {
        const delta = touchCurrentX.current - touchStartX.current;
        if (delta < -100) {
          router.push('/messages');
        }
      }
      touchStartX.current = null;
      touchCurrentX.current = null;
      setIsDragging(false);
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [router, showBackButton]);

  const startCall = async (callType: 'voice' | 'video') => {
    const calleeId = conversation?.otherUser?.user_id;
    if (!calleeId) return;

    try {
      const resp = await authedFetch('/api/calls', {
        method: 'POST',
        body: JSON.stringify({ callee_id: calleeId, call_type: callType }),
      });
      const payload = await resp.json();
      if (resp.ok && payload.room_id) {
        window.location.href = `/calls?room_id=${encodeURIComponent(payload.room_id)}`;
      } else {
        setNotice(payload.error || 'Unable to start call.');
      }
    } catch (error) {
      console.error('Unable to start call', error);
      setNotice('Unable to start call.');
    }
  };

  const sendMessage = async () => {
    if (!draft.trim() && !attachment) {
      setNotice('Type a message or attach a file.');
      return;
    }

    const form = new FormData();
    form.append('body', draft.trim());
    form.append('conversation_id', conversationId);
    if (attachment) form.append('media', attachment);

    const resp = await authedFetch('/api/messages', { method: 'POST', body: form });
    const payload = await resp.json();
    if (!resp.ok) {
      setNotice(payload.error || 'Failed to send.');
      return;
    }

    setDraft('');
    setAttachment(null);
    await loadThread();
    try {
      router.refresh();
    } catch (error) {
      console.error('Unable to refresh router after sending message', error);
    }
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const otherUserName = conversation?.otherUser?.display_name || conversation?.otherUser?.username || 'Contact';

  return (
    <main className={`transition-transform duration-300 ${isDragging ? 'translate-x-[-8px]' : 'translate-x-0'}`}>
      <div className="space-y-6 rounded-3xl border border-hairline bg-panel/80 p-5 shadow-lg shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {showBackButton ? (
              <Link href="/messages" className="rounded-full border border-hairline bg-panel/60 p-2 text-ivory transition hover:bg-ivory/10" aria-label="Back to messages">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M15 18l-6-6 6-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            ) : onClose ? (
              <button type="button" onClick={onClose} className="rounded-full border border-hairline bg-panel/60 p-2 text-ivory transition hover:bg-ivory/10" aria-label="Close thread">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M18 6l-12 12M6 6l12 12" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ) : null}
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-gold">Chat</p>
              <h1 className="text-3xl font-semibold text-ivory">{conversation?.title || otherUserName}</h1>
              {conversation?.otherUser?.user_id ? (
                <Link href={`/user/${conversation.otherUser.user_id}`} className="text-xs text-slate hover:underline">View profile</Link>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => startCall('voice')} className="rounded-full border border-hairline bg-panel/60 p-2 text-ivory transition hover:bg-ivory/10" title="Start voice call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07A19.38 19.38 0 0 1 3.07 9.74 19.86 19.86 0 0 1 0 1.11 1 1 0 0 1 1 0h4.09a1 1 0 0 1 1 .76c.12.83.33 1.64.63 2.42a1 1 0 0 1-.24 1.03L5.2 6.79a16 16 0 0 0 10.45 10.45l1.58-1.58a1 1 0 0 1 1.03-.24c.78.3 1.59.51 2.42.63a1 1 0 0 1 .76 1V22z" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button type="button" onClick={() => startCall('video')} className="rounded-full border border-hairline bg-panel/60 p-2 text-ivory transition hover:bg-ivory/10" title="Start video call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M15 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="6" width="12" height="12" rx="2" strokeWidth="1.4"/><path d="M9 10v4" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {notice ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{notice}</p> : null}

        <div className="flex min-h-[60vh] flex-col rounded-3xl border border-hairline bg-panel-2/70 shadow-inner shadow-black/10">
          <div className="flex items-center justify-between border-b border-hairline bg-panel/80 px-4 py-3 text-xs uppercase tracking-[0.28em] text-slate">
            <span>{messages.length} messages</span>
            <span>{conversation?.participantCount ?? 2} people</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length > 0 ? (
              messages.map((messageItem) => {
                const incoming = messageItem.sender_id === conversation?.otherUser?.user_id;
                return (
                  <div key={messageItem.id} className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[84%] rounded-[2rem] px-5 py-4 text-sm leading-7 ${incoming ? 'bg-panel/90 text-ivory' : 'bg-gold/10 text-obsidian'}`}>
                      {messageItem.body ? <p>{messageItem.body}</p> : null}
                      {messageItem.media_url ? (
                        <div className="mt-3 overflow-hidden rounded-3xl border border-hairline bg-panel/80">
                          {messageItem.media_type?.startsWith('image') ? (
                            <img src={messageItem.media_url} alt="Attachment" className="h-full w-full object-cover" />
                          ) : messageItem.media_type?.startsWith('video') ? (
                            <video controls src={messageItem.media_url} className="h-full w-full object-cover" />
                          ) : (
                            <audio controls src={messageItem.media_url} className="w-full" />
                          )}
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs text-slate">{new Date(messageItem.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-hairline bg-panel/70 p-6 text-center text-sm text-slate">
                No messages in this conversation yet. Send the first message to start the thread.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-hairline bg-panel/80 p-4 sm:p-5">
          <label className="text-sm text-slate">Reply</label>
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Write your reply…"
            className="mt-3 min-h-[120px] w-full rounded-3xl border border-hairline bg-obsidian/80 px-4 py-4 text-sm text-ivory outline-none focus:border-hairline-strong"
          />

          {attachment ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-3xl border border-hairline bg-panel/70 px-4 py-3 text-sm text-slate">
              <div>
                <p className="font-semibold text-ivory truncate">{attachment.name}</p>
                <p className="text-xs text-slate">{attachment.type || 'Attachment'}</p>
              </div>
              <button type="button" onClick={() => setAttachment(null)} className="rounded-full bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20">Remove</button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-hairline bg-panel px-4 py-3 text-sm text-ivory transition hover:bg-ivory/10">
                <span>{attachment ? 'Change attachment' : 'Attach file'}</span>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                />
              </label>
              {attachment ? (
                <span className="rounded-full bg-panel-2 px-3 py-2 text-sm text-slate">{attachment.name}</span>
              ) : null}
            </div>
            <button onClick={sendMessage} className="rounded-3xl bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110">
              Send message
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
