"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';

interface ChatThreadProps {
  conversationId: string;
  showBackButton?: boolean;
}

export default function ChatThread({ conversationId, showBackButton = false }: ChatThreadProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any | null>(null);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    if (!conversationId) return;
    const es = new EventSource('/api/messages/stream');
    const handler = (ev: MessageEvent) => {
      try {
        // always reload thread on update; server could include conversation hint in future
        void loadThread();
      } catch (e) {
        // ignore
      }
    };
    es.addEventListener('update', handler);
    es.onerror = () => {
      es.close();
      // fallback: poll
      const id = window.setInterval(() => void loadThread(), 3000);
      (es as any)._pollId = id;
    };
    return () => {
      if ((es as any)._pollId) window.clearInterval((es as any)._pollId);
      es.close();
    };
  }, [conversationId, loadThread]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      () => undefined,
      { root: null, threshold: 0.2 }
    );
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

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
    void loadThread();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recordedChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setAttachment(file);
        // stop tracks
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        // send the recorded voice note
        await sendMessage();
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (e) {
      setNotice('Unable to access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void sendMessage();
    }
  };

  const otherUserName = conversation?.title || conversation?.otherUser?.display_name || conversation?.otherUser?.username || 'Chat';

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="rounded-3xl border border-hairline bg-panel-2/70 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {showBackButton ? (
              <button onClick={() => router.push('/messages')} className="rounded-full border border-hairline bg-panel p-2 text-ivory transition hover:bg-ivory/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M15 18l-6-6 6-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ) : null}
            {conversation?.otherUser?.avatar_url ? (
              <img src={conversation.otherUser.avatar_url} alt={conversation.otherUser.display_name || conversation.otherUser.username} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-panel text-lg text-slate">
                {conversation?.otherUser?.display_name?.charAt(0)?.toUpperCase() || conversation?.otherUser?.username?.charAt(0)?.toUpperCase() || 'C'}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-gold">Chat</p>
              <h1 className="text-2xl font-semibold text-ivory">{otherUserName}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="rounded-full border border-hairline bg-panel p-2 text-ivory transition hover:bg-ivory/10" title="Voice call">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07A19.38 19.38 0 0 1 3.07 9.74 19.86 19.86 0 0 1 0 1.11 1 1 0 0 1 1 0h4.09a1 1 0 0 1 1 .76c.12.83.33 1.64.63 2.42a1 1 0 0 1-.24 1.03L5.2 6.79a16 16 0 0 0 10.45 10.45l1.58-1.58a1 1 0 0 1 1.03-.24c.78.3 1.59.51 2.42.63a1 1 0 0 1 .76 1V22z" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button type="button" className="rounded-full border border-hairline bg-panel p-2 text-ivory transition hover:bg-ivory/10" title="Video call">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M15 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="6" width="12" height="12" rx="2" strokeWidth="1.4"/><path d="M9 10v4" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-h-[60vh] flex-col rounded-3xl border border-hairline bg-panel-2/70 shadow-inner shadow-black/10">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {notice ? (
              <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{notice}</div>
            ) : null}
            {messages.length > 0 ? (
              messages.map((messageItem) => {
                const incoming = messageItem.sender_id === conversation?.otherUser?.user_id;
                return (
                  <div key={messageItem.id} className={`flex ${incoming ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[84%] rounded-3xl px-4 py-3 text-sm leading-7 ${incoming ? 'bg-panel/90 text-ivory' : 'bg-gold/10 text-obsidian'}`}>
                      {messageItem.body ? <p>{messageItem.body}</p> : null}
                      {messageItem.media_url ? (
                                  <div className="mt-3 overflow-hidden rounded-3xl border border-hairline bg-panel/80">
                                    {messageItem.media_type?.startsWith('image') ? (
                                      <img src={messageItem.media_url} alt="Attachment" className="h-full w-full object-cover" />
                                    ) : messageItem.media_type?.startsWith('video') ? (
                                      <video controls src={messageItem.media_url} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex items-center gap-3 px-4 py-3">
                                        <audio controls src={messageItem.media_url} className="w-full" />
                                        <div className={`${Date.now() - new Date(messageItem.created_at).getTime() < 3000 ? 'animate-pulse' : ''} ml-2`}> 
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6 text-gold"><path d="M2 12c0-2.21 1.79-4 4-4v8c-2.21 0-4-1.79-4-4zM10 6v12c0-3.31-2.69-6-6-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                      <p className="mt-2 text-xs text-slate">{new Date(messageItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-hairline bg-panel/70 p-6 text-center text-sm text-slate">
                No messages yet. Send the first one from the bar below.
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 rounded-b-3xl border border-t-0 border-hairline bg-panel/95 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <label className="rounded-full p-2 text-slate transition hover:bg-panel-2" title="Attach file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M21 12.79V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.21" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10l5 5 5-5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <input type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
              </label>
              <button type="button" className="rounded-full p-2 text-slate transition hover:bg-panel-2" title="Camera">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v12z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="3" strokeWidth="1.6"/></svg>
              </button>
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message"
                className="flex-1 rounded-full border border-transparent bg-panel px-4 py-3 text-sm text-ivory outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={async () => {
                    if (draft.trim()) {
                      await sendMessage();
                      return;
                    }
                    if (isRecording) {
                      stopRecording();
                    } else {
                      await startRecording();
                    }
                  }}
                  className="rounded-full bg-gold p-3 text-ivory transition hover:brightness-105"
                  title={draft.trim() ? 'Send message' : isRecording ? 'Stop recording' : 'Record voice note'}
                >
                  {draft.trim() ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M5 12h14" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 5l7 7-7 7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 10a7 7 0 0 1-14 0" strokeWidth="1.6" strokeLinecap="round"/><path d="M12 19v4" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  )}
                </button>
                {isRecording ? (
                  <span className="absolute -top-2 -right-2 flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                  </span>
                ) : null}
              </div>
            </div>
            {attachment ? <p className="mt-2 text-xs text-slate">Attachment ready: {attachment.name}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
