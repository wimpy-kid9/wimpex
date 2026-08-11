"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authedFetch } from '@/lib/api-client';

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id as string;

  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any | null>(null);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [isDragging, setIsDragging] = useState(false);
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

  const startCall = async (callType: 'voice' | 'video') => {
    if (!conversation?.otherUser?.user_id) return;
    try {
      const resp = await authedFetch('/api/calls', {
        method: 'POST',
        body: JSON.stringify({ callee_id: conversation.otherUser.user_id, call_type: callType })
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

  useEffect(() => {
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
  }, [router]);

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
    // optionally refresh conversations list on parent route
    try {
      router.refresh();
    } catch (error) {
      console.error('Unable to refresh router after sending message', error);
    }
  };

  return (
    <main className={`transition-transform duration-300 ${isDragging ? 'translate-x-[-8px]' : 'translate-x-0'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/messages" className="rounded-full border border-hairline bg-panel/60 p-2 text-ivory transition hover:bg-ivory/10" aria-label="Back to messages">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M15 18l-6-6 6-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-gold">Thread</p>
            <h2 className="text-2xl font-semibold text-ivory">{conversation?.title || conversation?.otherUser?.display_name || `Conversation ${conversationId}`}</h2>
            {conversation?.otherUser?.user_id ? (
              <Link href={`/user/${conversation.otherUser.user_id}`} className="text-xs text-slate hover:underline">View profile</Link>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startCall('voice')}
            className="rounded-full border border-hairline bg-panel/60 p-2 text-ivory transition hover:bg-ivory/10"
            title="Start voice call"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07A19.38 19.38 0 0 1 3.07 9.74 19.86 19.86 0 0 1 0 1.11 1 1 0 0 1 1 0h4.09a1 1 0 0 1 1 .76c.12.83.33 1.64.63 2.42a1 1 0 0 1-.24 1.03L5.2 6.79a16 16 0 0 0 10.45 10.45l1.58-1.58a1 1 0 0 1 1.03-.24c.78.3 1.59.51 2.42.63a1 1 0 0 1 .76 1V22z" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            onClick={() => startCall('video')}
            className="rounded-full border border-hairline bg-panel/60 p-2 text-ivory transition hover:bg-ivory/10"
            title="Start video call"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M15 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="6" width="12" height="12" rx="2" strokeWidth="1.4"/><path d="M9 10v4" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {notice ? <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{notice}</p> : null}

      <div className="mt-6 space-y-3">
        {messages.length > 0 ? messages.map((m) => (
          <div key={m.id} className={`rounded-3xl p-4 ${m.sender_id === conversation?.otherUser?.user_id ? 'bg-panel-2/80 text-ivory' : 'bg-gold/10 text-ivory'}`}>
            <div className="space-y-3">
              {m.body ? <p className="text-sm leading-7">{m.body}</p> : null}
              {m.media_url ? (
                <div className="rounded-3xl border border-hairline bg-panel/80 p-3">
                  {m.media_type?.startsWith('image') ? (
                    <img src={m.media_url} alt="Attachment" className="w-full rounded-2xl object-cover" />
                  ) : m.media_type?.startsWith('video') ? (
                    <video controls src={m.media_url} className="w-full rounded-2xl object-cover" />
                  ) : (
                    <audio controls src={m.media_url} className="w-full" />
                  )}
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate">{new Date(m.created_at).toLocaleString()}</p>
          </div>
        )) : (
          <div className="rounded-3xl border border-dashed border-hairline bg-panel-2/70 p-6 text-sm text-slate">No messages yet.</div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <label className="text-sm text-slate">New message</label>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write your message" className="mt-3 min-h-[140px] w-full rounded-3xl border border-hairline bg-panel/80 px-4 py-4 text-sm text-ivory outline-none focus:border-hairline-strong" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3 rounded-3xl border border-hairline bg-panel-2/70 p-4">
            <p className="text-sm text-slate">Attachments</p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-hairline bg-panel px-4 py-3 text-sm text-ivory transition hover:bg-ivory/5">
                <span>Choose file</span>
                <input type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
              </label>
            </div>
            {attachment ? (
              <div className="mt-3 rounded-2xl border border-hairline bg-panel/80 p-3 text-sm text-ivory">
                <p>Attached: {attachment.name}</p>
                <button type="button" onClick={() => setAttachment(null)} className="mt-2 inline-flex rounded-full bg-ivory/5 px-3 py-1 text-xs text-slate hover:bg-ivory/10">Remove</button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col justify-between gap-3">
            <div className="text-sm text-slate">{conversation?.otherUser ? `Sending to ${conversation.otherUser.display_name || conversation.otherUser.username}` : 'Sending'}</div>
            <button onClick={sendMessage} className="rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110">Send</button>
          </div>
        </div>
      </div>
    </main>
  );
}
