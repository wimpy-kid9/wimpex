"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';
import { renderRichText } from '@/lib/rich-text';
import GoldBadge from '@/app/components/GoldBadge';
import { markConversationRead } from '@/lib/chat-unread';
import { supabase } from '@/lib/supabase';
import { isGoldSubscription } from '@/lib/subscription';
import GoldUpgradeHint from '@/app/components/GoldUpgradeHint';

interface ChatThreadProps {
  conversationId: string;
  showBackButton?: boolean;
}

export default function ChatThread({ conversationId, showBackButton = false }: ChatThreadProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any | null>(null);
  const [draft, setDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [senderIsGold, setSenderIsGold] = useState(false);
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [callLoading, setCallLoading] = useState(false);
  const [replySwipeOffset, setReplySwipeOffset] = useState(0);
  const [pageSwipeOffset, setPageSwipeOffset] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [allowsFinePointer, setAllowsFinePointer] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<any[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const touchStateRef = useRef({
    messageId: '',
    startX: 0,
    startY: 0,
    replySwipe: false,
    moved: false,
    longPressTriggered: false,
    holding: false
  });
  const pageTouchRef = useRef({ startX: 0, startY: 0, tracking: false });
  const longPressTimerRef = useRef<number | null>(null);
  const reactionOptions = useMemo(() => ['👍', '❤️', '😂', '👏', '🔥'], []);
  const messagesById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
  const mostRecentOwnMessageId = useMemo(
    () => [...messages].reverse().find((message) => message.sender_id === currentUserId)?.id || null,
    [currentUserId, messages]
  );
  const messagesWithReply = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        replyPreview:
          message.replyPreview ?? (message.reply_to_message_id ? messagesById.get(message.reply_to_message_id) ?? null : null)
      })),
    [messages, messagesById]
  );

  const loadThread = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const resp = await authedFetch(`/api/messages?conversation_id=${encodeURIComponent(conversationId)}`);
      const payload = await resp.json();
      if (!resp.ok) {
        setNotice(payload.error || 'Unable to load messages.');
        return;
      }
      setMessages(payload.messages || []);
      if (payload.conversation) setConversation(payload.conversation);
      setHasEarlier(Boolean(payload.hasMore));
    } catch (error) {
      setNotice(error instanceof TypeError ? 'You appear to be offline. Reconnect and retry.' : 'Unable to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  }, [conversationId]);

  const loadEarlier = useCallback(async () => {
    const oldest = messages[0]?.created_at;
    if (!oldest || loadingEarlier || !hasEarlier) return;
    setLoadingEarlier(true);
    try {
      const response = await authedFetch(`/api/messages?conversation_id=${encodeURIComponent(conversationId)}&before=${encodeURIComponent(oldest)}`);
      const payload = await response.json();
      if (response.ok) {
        setMessages((current) => [...(payload.messages || []), ...current]);
        setHasEarlier(Boolean(payload.hasMore));
      }
    } finally {
      setLoadingEarlier(false);
    }
  }, [conversationId, hasEarlier, loadingEarlier, messages]);

  useEffect(() => {
    if (!conversationId) return;
    void loadThread();
    markConversationRead(conversationId);
  }, [conversationId, loadThread]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }: { data: { session: any } }) => {
      const userId = data.session?.user?.id || null;
      if (!cancelled) setCurrentUserId(userId);
      if (userId) void authedFetch('/api/profile').then((response) => response.json()).then((payload) => {
        if (!cancelled) setSenderIsGold(isGoldSubscription(payload.subscription));
      });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    const timer = window.setTimeout(() => {
      void authedFetch('/api/messages/read', {
        method: 'PATCH',
        body: JSON.stringify({ conversationId })
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [conversationId, currentUserId, messages.length]);

  useEffect(() => {
    setAllowsFinePointer(typeof window !== 'undefined' && window.matchMedia('(pointer:fine)').matches);
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const es = new EventSource('/api/messages/stream');
    const handler = () => {
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
      const id = window.setInterval(() => void loadThread(), 500);
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
    if (!highlightedMessageId) return;
    const timeout = window.setTimeout(() => setHighlightedMessageId(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [highlightedMessageId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      () => undefined,
      { root: null, threshold: 0.2 }
    );
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  const clearReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleReplyToMessage = useCallback((message: any) => {
    setReplyingTo(message);
    setReactionPickerFor(null);
    setActionMenuFor(null);
    inputRef.current?.focus();
  }, []);

  const handleMessageBubbleClick = useCallback(
    (messageId: string, event: MouseEvent<HTMLDivElement>) => {
      if (!allowsFinePointer) return;
      event.stopPropagation();
      setActionMenuFor((current) => (current === messageId ? null : messageId));
      setReactionPickerFor(null);
    },
    [allowsFinePointer]
  );

  const scrollToMessage = useCallback((messageId: string) => {
    const node = messageRefs.current.get(messageId);
    if (!node || !scrollRef.current) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
  }, []);

  const canStartCall = Boolean(conversation?.otherUser?.user_id && !conversation?.isGroup);

  const updateWallpaper = useCallback(async (wallpaperColor: string | null) => {
    if (!senderIsGold) return;
    const response = await authedFetch('/api/messages/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ conversationId, wallpaperColor, reset: wallpaperColor === null })
    });
    if (!response.ok) {
      setNotice((await response.json()).error || 'Unable to update chat wallpaper.');
      return;
    }
    setConversation((current: any) => ({ ...current, wallpaperColor, wallpaperUrl: null }));
    setWallpaperPickerOpen(false);
  }, [conversationId, senderIsGold]);

  const uploadWallpaper = useCallback(async (file: File | null) => {
    if (!file || !senderIsGold) return;
    const formData = new FormData();
    formData.append('conversationId', conversationId);
    formData.append('wallpaper', file);
    const response = await authedFetch('/api/messages/preferences', { method: 'PATCH', body: formData });
    if (!response.ok) {
      setNotice((await response.json()).error || 'Unable to upload chat wallpaper.');
      return;
    }
    const payload = await response.json();
    setConversation((current: any) => ({ ...current, wallpaperUrl: payload.wallpaperUrl, wallpaperColor: null }));
    setWallpaperPickerOpen(false);
  }, [conversationId, senderIsGold]);

  const handleStartCall = useCallback(
    async (callType: 'voice' | 'video') => {
      if (!conversation?.otherUser?.user_id) return;
      setNotice('');
      setCallLoading(true);

      try {
        const response = await authedFetch('/api/calls', {
          method: 'POST',
          body: JSON.stringify({ callee_id: conversation.otherUser.user_id, call_type: callType })
        });
        const payload = await response.json();
        if (!response.ok) {
          setNotice(payload.error || 'Unable to start call.');
          return;
        }
        if (payload.call?.room_id) {
          window.open(payload.call.room_id, '_blank');
        } else {
          setNotice('Call started. Check your call history.');
          router.push('/calls');
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Unable to start call.');
      } finally {
        setCallLoading(false);
      }
    },
    [conversation?.otherUser?.user_id, conversation?.isGroup, router]
  );

  const toggleReactionPicker = useCallback((messageId: string) => {
    setReactionPickerFor((current) => (current === messageId ? null : messageId));
  }, []);

  const sendReaction = useCallback(
    async (messageId: string, emoji: string) => {
      setNotice('');
      const response = await authedFetch('/api/messages/reactions', {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId, emoji })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || 'Unable to add reaction.');
        return;
      }
      setMessages((current) => current.map((msg) => (msg.id === messageId ? { ...msg, ...payload.message } : msg)));
      setReactionPickerFor(null);
    },
    []
  );

  const sendMessage = async (overrideAttachment?: File) => {
    const effectiveAttachment = overrideAttachment ?? attachment;
    const trimmedDraft = draft.trim();
    if (!trimmedDraft && !effectiveAttachment) {
      setNotice('Type a message or attach a file.');
      return;
    }

    const form = new FormData();
    form.append('body', trimmedDraft);
    form.append('conversation_id', conversationId);
    if (replyingTo) {
      form.append('reply_to_message_id', replyingTo.id);
    }
    if (effectiveAttachment) form.append('media', effectiveAttachment);

    const resp = await authedFetch('/api/messages', { method: 'POST', body: form });
    const payload = await resp.json();
    if (!resp.ok) {
      setNotice(payload.error || 'Failed to send.');
      return;
    }

    setDraft('');
    setAttachment(null);
    clearReply();
    void loadThread();
  };

  const updateOwnMessage = async (message: any, unsend = false) => {
    const response = await authedFetch(`/api/messages/${message.id}`, {
      method: unsend ? 'DELETE' : 'PATCH',
      body: unsend ? undefined : JSON.stringify({ body: draft })
    });
    if (!response.ok) {
      setNotice((await response.json()).error || 'Unable to update message.');
      return;
    }
    const payload = await response.json();
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, ...payload.message } : item));
    setEditingMessageId(null);
    setDraft('');
    setActionMenuFor(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recordedChunksRef.current = [];
      mr.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mr.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setAttachment(file);
        await sendMessage(file);
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

  const otherUserName = useMemo(
    () => conversation?.title || conversation?.otherUser?.display_name || conversation?.otherUser?.username || 'Chat',
    [conversation]
  );

  const handleMessageTouchStart = (messageId: string, event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStateRef.current = {
      messageId,
      startX: touch.clientX,
      startY: touch.clientY,
      replySwipe: false,
      moved: false,
      longPressTriggered: false,
      holding: true
    };
    setReplySwipeOffset(0);
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      const current = touchStateRef.current;
      if (current.holding) {
        current.longPressTriggered = true;
      }
    }, 320);
  };

  const handleMessageTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    const current = touchStateRef.current;
    const deltaX = touch.clientX - current.startX;
    const deltaY = touch.clientY - current.startY;
    if (Math.abs(deltaY) > 30) {
      current.holding = false;
      current.longPressTriggered = false;
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }
    if (current.longPressTriggered && deltaX > 16) {
      current.replySwipe = true;
      current.moved = true;
      setReplySwipeOffset(Math.min(deltaX, 80));
    }
  };

  const handlePageTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch.clientX > 36) return;
    pageTouchRef.current = { startX: touch.clientX, startY: touch.clientY, tracking: true };
    setPageSwipeOffset(0);
  };

  const handlePageTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    const pageTouch = pageTouchRef.current;
    if (!pageTouch.tracking) return;
    const deltaX = touch.clientX - pageTouch.startX;
    const deltaY = touch.clientY - pageTouch.startY;
    if (Math.abs(deltaY) > 40) {
      pageTouch.tracking = false;
      setPageSwipeOffset(0);
      return;
    }
    if (deltaX > 0) {
      setPageSwipeOffset(Math.min(deltaX, 120));
    }
  };

  const handlePageTouchEnd = () => {
    if (pageTouchRef.current.tracking && pageSwipeOffset > 80) {
      router.push('/messages');
    }
    pageTouchRef.current.tracking = false;
    setPageSwipeOffset(0);
  };

  const handleMessageTouchEnd = () => {
    const current = touchStateRef.current;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (current.longPressTriggered) {
      if (current.replySwipe && current.moved && replySwipeOffset > 50) {
        const message = messagesById.get(current.messageId);
        if (message) {
          handleReplyToMessage(message);
        }
      } else {
        setReactionPickerFor(current.messageId);
      }
    }

    setReplySwipeOffset(0);
    touchStateRef.current = {
      messageId: '',
      startX: 0,
      startY: 0,
      replySwipe: false,
      moved: false,
      longPressTriggered: false,
      holding: false
    };
  };

  return (
    <main
      onClick={() => { if (actionMenuFor) setActionMenuFor(null); if (headerMenuOpen) setHeaderMenuOpen(false); if (attachMenuOpen) setAttachMenuOpen(false); }}
      onTouchStart={handlePageTouchStart}
      onTouchMove={handlePageTouchMove}
      onTouchEnd={handlePageTouchEnd}
      style={{ transform: pageSwipeOffset ? `translateX(${pageSwipeOffset}px)` : undefined }}
      className="h-full min-h-0 overflow-hidden flex flex-col px-4 pt-6 pb-3 sm:px-6 lg:px-8 md:pb-6 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      <div className="mx-auto w-full max-w-3xl flex-1 min-h-0 flex flex-col space-y-6">
        <section className="rounded-3xl border border-hairline bg-panel-2/70 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {showBackButton ? (
              <button onClick={() => router.push('/messages')} className="rounded-full border border-hairline bg-panel p-2 text-ivory transition hover:bg-ivory/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M15 18l-6-6 6-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ) : null}
            {conversation?.otherUser?.user_id ? (
              <Link href={`/user/${conversation.otherUser.user_id}`} className="flex items-center gap-3">
                {conversation.otherUser.avatar_url ? (
                  <img src={conversation.otherUser.avatar_url} alt={conversation.otherUser.display_name || conversation.otherUser.username} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-panel text-lg text-slate">
                    {conversation?.otherUser?.display_name?.charAt(0)?.toUpperCase() || conversation?.otherUser?.username?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-gold">Chat</p>
                  <div className="mt-1 flex items-center gap-2">
                    <h1 className="text-2xl font-semibold text-ivory">{otherUserName}</h1>
                    {conversation?.otherUser?.is_gold ? <GoldBadge size="sm" inline /> : null}
                  </div>
                </div>
              </Link>
            ) : (
              <>
                {conversation?.otherUser?.avatar_url ? (
                  <img src={conversation.otherUser.avatar_url} alt={conversation.otherUser.display_name || conversation.otherUser.username} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-panel text-lg text-slate">
                    {conversation?.otherUser?.display_name?.charAt(0)?.toUpperCase() || conversation?.otherUser?.username?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-gold">Chat</p>
                  <div className="mt-1 flex items-center gap-2">
                    <h1 className="text-2xl font-semibold text-ivory">{otherUserName}</h1>
                    {conversation?.otherUser?.is_gold ? <GoldBadge size="sm" inline /> : null}
                  </div>
                </div>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setHeaderMenuOpen((open) => !open); }}
                  className="rounded-full border border-hairline bg-panel p-2 text-ivory transition hover:bg-ivory/10"
                  title="Chat options"
                  aria-label="Chat options"
                  aria-expanded={headerMenuOpen}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                </button>
                {headerMenuOpen ? (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="absolute right-0 top-full z-20 mt-2 w-56 space-y-1 rounded-3xl border border-hairline bg-panel p-2 shadow-2xl shadow-black/30"
                  >
                    <button
                      type="button"
                      onClick={() => { setHeaderMenuOpen(false); void handleStartCall('voice'); }}
                      disabled={!canStartCall || callLoading}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-ivory transition hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 flex-shrink-0"><path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07A19.38 19.38 0 0 1 3.07 9.74 19.86 19.86 0 0 1 0 1.11 1 1 0 0 1 1 0h4.09a1 1 0 0 1 1 .76c.12.83.33 1.64.63 2.42a1 1 0 0 1-.24 1.03L5.2 6.79a16 16 0 0 0 10.45 10.45l1.58-1.58a1 1 0 0 1 1.03-.24c.78.3 1.59.51 2.42.63a1 1 0 0 1 .76 1V22z" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Voice call
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHeaderMenuOpen(false); void handleStartCall('video'); }}
                      disabled={!canStartCall || callLoading}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-ivory transition hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 flex-shrink-0"><path d="M15 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="6" width="12" height="12" rx="2" strokeWidth="1.4"/><path d="M9 10v4" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      Video call
                    </button>
                    <div className="my-1 border-t border-hairline" />
                    {senderIsGold ? (
                      <button
                        type="button"
                        onClick={() => { setHeaderMenuOpen(false); setWallpaperPickerOpen((open) => !open); }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-ivory transition hover:bg-panel-2"
                      >
                        <span className="text-base">🖼️</span>
                        Chat wallpaper
                      </button>
                    ) : (
                      <div className="px-3 py-2">
                        <GoldUpgradeHint compact perk="Chat wallpapers" detail="Preview custom colors and images for this conversation, then unlock them with Gold." />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {wallpaperPickerOpen ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/30 bg-panel/95 p-3">
              {['#18233d', '#173b2a', '#40202a', '#34204a', '#4a321c'].map((color) => (
                <button key={color} type="button" onClick={() => void updateWallpaper(color)} className="h-8 w-8 rounded-full border border-white/30" style={{ backgroundColor: color }} title="Use wallpaper color" />
              ))}
              <button type="button" onClick={() => wallpaperInputRef.current?.click()} className="rounded-full border border-hairline px-3 py-2 text-xs text-ivory">Upload image</button>
              <button type="button" onClick={() => void updateWallpaper(null)} className="rounded-full border border-hairline px-3 py-2 text-xs text-slate">Reset</button>
              <input ref={wallpaperInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadWallpaper(event.target.files?.[0] || null)} />
            </div>
          ) : null}
        </section>

        <section className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-3xl border border-hairline bg-panel-2/70 shadow-inner shadow-black/10">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-cover bg-center px-4 py-5 space-y-4" style={{ backgroundColor: conversation?.wallpaperColor || undefined, backgroundImage: conversation?.wallpaperUrl ? `url(${conversation.wallpaperUrl})` : undefined }}>
            {hasEarlier ? (
              <button type="button" onClick={() => void loadEarlier()} disabled={loadingEarlier} className="mx-auto block rounded-full border border-hairline px-3 py-1 text-xs text-slate hover:bg-panel disabled:opacity-50">
                {loadingEarlier ? 'Loading earlier…' : 'Load earlier messages'}
              </button>
            ) : null}
            {notice ? (
              <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{notice}</div>
            ) : null}
            {loadingMessages && messagesWithReply.length === 0 ? (
              <div className="space-y-4" aria-label="Loading messages">
                <div className="h-16 w-2/3 animate-pulse rounded-3xl bg-panel" />
                <div className="ml-auto h-16 w-1/2 animate-pulse rounded-3xl bg-gold/10" />
                <div className="h-12 w-3/5 animate-pulse rounded-3xl bg-panel" />
              </div>
            ) : messagesWithReply.length > 0 ? (
              messagesWithReply.map((messageItem) => {
                const incoming = messageItem.sender_id === conversation?.otherUser?.user_id;
                const replyPreview = messageItem.replyPreview;
                const isHighlighted = highlightedMessageId === messageItem.id;
                const isCallLog = messageItem.media_type === 'call_log';
                const sharedPost = messageItem.sharedPost;
                return (
                  <div
                    key={messageItem.id}
                    ref={(node) => {
                      if (node) {
                        messageRefs.current.set(messageItem.id, node);
                      } else {
                        messageRefs.current.delete(messageItem.id);
                      }
                    }}
                    className={`flex items-end gap-2 ${incoming ? 'justify-start' : 'justify-end'}`}
                    onClick={(event) => handleMessageBubbleClick(messageItem.id, event)}
                    onTouchStart={(event) => handleMessageTouchStart(messageItem.id, event)}
                    onTouchMove={handleMessageTouchMove}
                    onTouchEnd={handleMessageTouchEnd}
                  >
                    {incoming && conversation?.otherUser ? (
                      conversation.otherUser.avatar_url ? (
                        <img src={conversation.otherUser.avatar_url} alt={conversation.otherUser.display_name || conversation.otherUser.username} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-panel-2 text-xs text-slate">{(conversation.otherUser.display_name || conversation.otherUser.username || 'U').charAt(0).toUpperCase()}</div>
                      )
                    ) : null}
                    <div
                      className={`relative max-w-[84%] rounded-3xl px-4 py-3 text-sm leading-7 ${incoming ? 'bg-panel/90 text-ivory' : 'bg-gold text-[color:var(--gold-contrast)]'} ${isHighlighted ? 'ring-2 ring-gold/60' : ''}`}
                      style={{ transform: messageItem.id === touchStateRef.current.messageId ? `translateX(${replySwipeOffset}px)` : undefined }}
                    >
                      {replyPreview ? (
                        <button
                          type="button"
                          onClick={() => replyPreview?.id && scrollToMessage(replyPreview.id)}
                          className="mb-2 w-full rounded-3xl border border-hairline bg-panel/80 px-3 py-2 text-left text-xs text-slate transition hover:bg-panel/70"
                        >
                          Replying to: {replyPreview.body ? `${replyPreview.body.slice(0, 80)}${replyPreview.body.length > 80 ? '…' : ''}` : 'Media message'}
                        </button>
                      ) : null}
                      {sharedPost ? (
                        <Link
                          href={`/post/${messageItem.shared_post_id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="block min-w-[220px] overflow-hidden rounded-2xl border border-hairline bg-panel/80 transition hover:border-gold"
                        >
                          {sharedPost.thumbnail_url || sharedPost.image_url || sharedPost.video_url ? (
                            <img
                              src={sharedPost.thumbnail_url || sharedPost.image_url || sharedPost.video_url}
                              alt={sharedPost.caption || 'Shared post'}
                              className="h-32 w-full object-cover"
                            />
                          ) : null}
                          <div className="p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Shared post</p>
                            <p className="mt-1 line-clamp-2 text-sm text-ivory">{sharedPost.caption || 'View shared post'}</p>
                            {sharedPost.author ? <p className="mt-1 text-xs text-slate">{sharedPost.author.display_name || sharedPost.author.username || 'WIMPEX user'}</p> : null}
                          </div>
                        </Link>
                      ) : isCallLog ? (
                        <div className="min-w-[180px] text-center">
                          <p className="font-semibold text-ivory">{messageItem.metadata?.status === 'missed' ? 'Missed call' : incoming ? 'Incoming call' : 'Outgoing call'}</p>
                          {messageItem.metadata?.duration != null ? <p className="mt-1 text-xs text-slate">Duration {Math.floor(messageItem.metadata.duration / 60)}:{String(messageItem.metadata.duration % 60).padStart(2, '0')}</p> : null}
                        </div>
                      ) : messageItem.unsent_at ? <div className="italic text-slate">Message unsent</div> : messageItem.body ? <div>{renderRichText(messageItem.body || '', { className: 'break-words', linkClassName: 'text-sky-400 underline decoration-sky-400/80 underline-offset-2 hover:text-sky-300' })}</div> : null}
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
                      <div className={`mt-3 flex items-center justify-between gap-2 text-xs ${incoming ? 'text-slate' : 'text-[color:var(--gold-contrast)] opacity-70'}`}>
                        <span>{new Date(messageItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{messageItem.edited_at ? ' · edited' : ''}</span>
                        {messageItem.id === mostRecentOwnMessageId && messageItem.read_at ? (
                          <span className="text-[10px]">{senderIsGold ? `Read ${new Date(messageItem.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Read'}</span>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={(event) => { event.stopPropagation(); handleReplyToMessage(messageItem); }} className={`rounded-full px-2 py-1 transition ${incoming ? 'hover:bg-panel/80' : 'hover:bg-black/10'}`}>Reply</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); toggleReactionPicker(messageItem.id); }} className={`rounded-full px-2 py-1 transition ${incoming ? 'hover:bg-panel/80' : 'hover:bg-black/10'}`}>React</button>
                          {messageItem.media_url ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const link = document.createElement('a');
                                link.href = messageItem.media_url;
                                link.download = messageItem.media_url.split('/').pop() || 'download';
                                link.target = '_blank';
                                link.rel = 'noopener noreferrer';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className={`rounded-full px-2 py-1 transition ${incoming ? 'hover:bg-panel/80' : 'hover:bg-black/10'}`}
                              title="Download"
                            >
                              ↓
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {Object.keys(messageItem.reactions || {}).length ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                          {Object.entries(messageItem.reactions).map(([emoji, reaction]: any) => (
                            <button
                              key={`${messageItem.id}-${emoji}`}
                              type="button"
                              onClick={() => void sendReaction(messageItem.id, emoji)}
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs transition ${reaction.reactedByMe ? 'bg-gold/15 text-gold' : 'bg-panel/80 text-slate'} hover:bg-panel/90`}
                            >
                              <span>{emoji}</span>
                              {reaction.count > 1 ? <span className="ml-1 text-[10px]">{reaction.count}</span> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {reactionPickerFor === messageItem.id ? (
                        <div className="mt-3 flex flex-wrap gap-2 rounded-3xl bg-panel/90 p-3">
                          {reactionOptions.map((emoji) => (
                            <button key={emoji} type="button" onClick={() => void sendReaction(messageItem.id, emoji)} className="rounded-full border border-hairline bg-panel px-3 py-2 text-sm transition hover:bg-panel-2">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {actionMenuFor === messageItem.id ? (
                        <div className="absolute right-0 top-0 z-10 mt-1 w-32 rounded-3xl border border-hairline bg-panel p-2 shadow-2xl shadow-black/20">
                          <button type="button" onClick={() => handleReplyToMessage(messageItem)} className="w-full rounded-3xl px-3 py-2 text-left text-xs text-ivory transition hover:bg-panel/80">Reply</button>
                          {messageItem.sender_id === currentUserId ? <><button type="button" onClick={() => { setEditingMessageId(messageItem.id); setDraft(messageItem.body || ''); setActionMenuFor(null); }} className="w-full rounded-3xl px-3 py-2 text-left text-xs text-ivory transition hover:bg-panel/80">Edit</button><button type="button" onClick={() => void updateOwnMessage(messageItem, true)} className="w-full rounded-3xl px-3 py-2 text-left text-xs text-rose-200 transition hover:bg-panel/80">Unsend</button></> : null}
                          <button type="button" onClick={() => toggleReactionPicker(messageItem.id)} className="w-full rounded-3xl px-3 py-2 text-left text-xs text-ivory transition hover:bg-panel/80">React</button>
                          <button type="button" onClick={() => setActionMenuFor(null)} className="w-full rounded-3xl px-3 py-2 text-left text-xs text-slate transition hover:bg-panel/80">Close</button>
                        </div>
                      ) : null}
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

          <div className="rounded-b-3xl border border-t-0 border-hairline bg-panel/95 px-4 py-3 backdrop-blur-xl">
            {replyingTo ? (
              <div className="mb-3 rounded-3xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-slate">
                Replying to <span className="font-semibold text-ivory">{replyingTo.body || 'a message'}</span>
                <button type="button" onClick={clearReply} className="ml-3 text-xs uppercase tracking-[0.24em] text-gold">
                  Cancel
                </button>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setAttachMenuOpen((open) => !open); }}
                  className="rounded-full p-2 text-slate transition hover:bg-panel-2"
                  title="Add attachment"
                  aria-label="Add attachment"
                  aria-expanded={attachMenuOpen}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M12 5v14M5 12h14" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </button>
                {attachMenuOpen ? (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="absolute bottom-full left-0 z-20 mb-2 w-44 space-y-1 rounded-3xl border border-hairline bg-panel p-2 text-left shadow-2xl shadow-black/30"
                  >
                    <button
                      type="button"
                      onClick={() => { setAttachMenuOpen(false); attachInputRef.current?.click(); }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-ivory transition hover:bg-panel-2"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 flex-shrink-0"><path d="M21 12.79V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.21" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10l5 5 5-5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      File
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAttachMenuOpen(false); cameraInputRef.current?.click(); }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-ivory transition hover:bg-panel-2"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 flex-shrink-0"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v12z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="3" strokeWidth="1.6"/></svg>
                      Camera
                    </button>
                  </div>
                ) : null}
                <input ref={attachInputRef} type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  className="hidden"
                  onClick={(event) => {
                    const target = event.currentTarget as HTMLInputElement;
                    if (!target.value) {
                      target.value = '';
                    }
                  }}
                  onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                />
              </div>

              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={editingMessageId ? 'Edit message' : 'Message'}
                className="w-0 min-w-0 flex-1 rounded-full border border-transparent bg-panel px-4 py-3 text-sm text-ivory outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingMessageId) {
                      const message = messagesById.get(editingMessageId);
                      if (message) await updateOwnMessage(message);
                      return;
                    }
                    if (draft.trim() || attachment) {
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
                  title={draft.trim() || attachment ? 'Send message' : isRecording ? 'Stop recording' : 'Record voice note'}
                >
                  {draft.trim() || attachment ? (

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
            {attachment ? (
              <div className="mt-2 rounded-3xl bg-panel/80 px-3 py-2 text-xs text-slate">Attachment ready: {attachment.name}</div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
