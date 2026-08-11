"use client";

import { useEffect, useState } from 'react';
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

  const loadThread = async () => {
    const resp = await authedFetch(`/api/messages?conversation_id=${encodeURIComponent(conversationId)}`);
    const payload = await resp.json();
    if (!resp.ok) {
      setNotice(payload.error || 'Unable to load messages.');
      return;
    }
    setMessages(payload.messages || []);
    if (payload.conversation) setConversation(payload.conversation);
  };

  useEffect(() => {
    if (!conversationId) return;
    void loadThread();
  }, [conversationId]);

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
    try { router.refresh(); } catch {}
  };

  return (
    <main>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gold">Thread</p>
          <h2 className="text-2xl font-semibold text-ivory">{conversation?.title || conversation?.otherUser?.display_name || `Conversation ${conversationId}`}</h2>
          {conversation?.otherUser?.user_id ? (
            <Link href={`/user/${conversation.otherUser.user_id}`} className="text-xs text-slate hover:underline">View profile</Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* call icon - starts a call flow elsewhere */}
          <button className="rounded-md p-2 text-ivory bg-panel/60" title="Start call">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07A19.38 19.38 0 0 1 3.07 9.74 19.86 19.86 0 0 1 0 1.11 1 1 0 0 1 1 0h4.09a1 1 0 0 1 1 .76c.12.83.33 1.64.63 2.42a1 1 0 0 1-.24 1.03L5.2 6.79a16 16 0 0 0 10.45 10.45l1.58-1.58a1 1 0 0 1 1.03-.24c.78.3 1.59.51 2.42.63a1 1 0 0 1 .76 1V22z" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
            <button onClick={sendMessage} className="rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110">Send</button>
          </div>
        </div>
      </div>
    </main>
  );
}
