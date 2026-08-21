"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';

interface WimpyAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function WimpyAIChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<WimpyAIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [loadedSession, setLoadedSession] = useState(false);

  // Load session history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('wimpyai-session');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(Array.isArray(parsed) ? parsed : []);
      } catch {
        setMessages([]);
      }
    }
    setLoadedSession(true);
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (loadedSession) {
      localStorage.setItem('wimpyai-session', JSON.stringify(messages));
    }
  }, [messages, loadedSession]);

  // Auto-scroll to bottom
  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage: WimpyAIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setNotice('');
    setLoading(true);

    try {
      // Call WimpyAI via our own server-side proxy to avoid browser CORS
      // restrictions (the WimpyAI service doesn't send an
      // Access-Control-Allow-Origin header for this origin). Must use
      // authedFetch — the proxy requires a Bearer token (requireAuth) to
      // track per-user daily usage limits, and a plain fetch() never sent
      // one, so every request here was rejected with 401.
      const response = await authedFetch('/api/wimpyai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: trimmed })
      });

      if (!response.ok) {
        // The proxy sends a real, specific message in the JSON body
        // (e.g. "WimpyAI is temporarily unavailable: ...", a quota error,
        // etc.) — surface that instead of a generic string so failures are
        // actually diagnosable from the UI.
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || 'WimpyAI service error');
      }

      const payload = await response.json();
      const assistantMessage: WimpyAIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: payload.reply || 'No response received. Please try again.',
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to reach WimpyAI. Please try again later.';
      setNotice(errorMessage);
      // Remove the user message if request failed
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  }, [draft, loading]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const clearSession = () => {
    if (window.confirm('Clear all messages?')) {
      setMessages([]);
      localStorage.removeItem('wimpyai-session');
    }
  };

  return (
    <main className="h-full min-h-0 overflow-hidden flex flex-col px-4 pt-6 pb-3 sm:px-6 lg:px-8 md:pb-6">
      <div className="mx-auto w-full max-w-3xl flex-1 min-h-0 flex flex-col space-y-6">
        <section className="rounded-3xl border border-hairline bg-panel-2/70 p-4 shadow-sm">
          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/messages')}
                className="rounded-full border border-hairline bg-panel p-2 text-ivory transition hover:bg-ivory/10"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                  <path d="M15 18l-6-6 6-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-lg font-bold text-white">
                AI
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-purple-400">AI Assistant</p>
                <h1 className="text-2xl font-semibold text-ivory">WimpyAI</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={clearSession}
              className="rounded-full border border-hairline bg-panel p-2 text-slate transition hover:bg-panel-2"
              title="Clear chat history"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-2 0v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8h10" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>

        <section className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-3xl border border-hairline bg-panel-2/70 shadow-inner shadow-black/10">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
            {notice ? (
              <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{notice}</div>
            ) : null}
            {messages.length === 0 ? (
              <div className="flex min-h-full items-center justify-center rounded-3xl border border-dashed border-hairline bg-panel/70 p-6 text-center">
                <div className="space-y-4">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-2xl font-bold text-white">
                    AI
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ivory">Welcome to WimpyAI</h3>
                    <p className="mt-2 text-sm text-slate max-w-xs">Ask me questions, explore creative ideas, or chat about anything on your mind.</p>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' ? (
                    <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-sm font-bold text-white">
                      AI
                    </div>
                  ) : null}
                  <div
                    className={`max-w-[84%] rounded-3xl px-4 py-3 text-sm leading-7 ${
                      message.role === 'user'
                        ? 'bg-gold text-[color:var(--gold-contrast)]'
                        : 'bg-panel/90 text-ivory'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p className={`mt-2 text-xs ${message.role === 'user' ? 'text-[color:var(--gold-contrast)] opacity-70' : 'text-slate'}`}>
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {message.role === 'user' ? (
                    <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-panel text-sm text-ivory">
                      U
                    </div>
                  ) : null}
                </div>
              ))
            )}
            {loading ? (
              <div className="flex gap-3 justify-start">
                <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-sm font-bold text-white">
                  AI
                </div>
                <div className="rounded-3xl bg-panel/90 px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-slate animate-bounce" />
                    <div className="h-2 w-2 rounded-full bg-slate animate-bounce delay-100" />
                    <div className="h-2 w-2 rounded-full bg-slate animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-b-3xl border border-t-0 border-hairline bg-panel/95 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message WimpyAI..."
                className="flex-1 rounded-full border border-transparent bg-panel px-4 py-3 text-sm text-ivory outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!draft.trim() || loading}
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 p-3 text-ivory transition hover:brightness-110 disabled:opacity-50"
                title="Send message"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
