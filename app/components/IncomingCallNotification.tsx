'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

export interface IncomingCallNotificationProps {
  callId: string;
  callerId: string;
  callerName?: string;
  callerAvatar?: string;
  callType: 'voice' | 'video';
  // eslint-disable-next-line no-unused-vars
  onAccept: (callId: string) => Promise<void>;
  // eslint-disable-next-line no-unused-vars
  onDecline: (callId: string) => Promise<void>;
}

/**
 * Incoming call notification overlay
 */
export default function IncomingCallNotification({
  callId,
  callerId,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onDecline
}: IncomingCallNotificationProps) {
  const [responding, setResponding] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callerInfo, setCallerInfo] = useState<any>(null);

  // Fetch caller info if not provided
  useEffect(() => {
    if (callerName) {
      setCallerInfo({ display_name: callerName, avatar_url: callerAvatar });
      return;
    }

    const fetchCaller = async () => {
      try {
        const response = await authedFetch(`/api/profile/${callerId}`);
        if (response.ok) {
          const data = await response.json();
          setCallerInfo(data.profile);
        }
      } catch (err) {
        console.error('Error fetching caller info:', err);
      }
    };

    void fetchCaller();
  }, [callerId, callerName, callerAvatar]);

  const handleAccept = async () => {
    setResponding(true);
    try {
      await onAccept(callId);
    } finally {
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    setResponding(true);
    try {
      await onDecline(callId);
    } finally {
      setResponding(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 w-64 rounded-2xl border border-gold/40 bg-panel/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6">
        <div className="flex items-center gap-3">
          {callerInfo?.avatar_url ? (
            <img src={callerInfo.avatar_url} alt={callerInfo.display_name} className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-panel-2 text-lg font-semibold text-slate">
              {(callerInfo?.display_name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setIsMinimized(false)}>
            <p className="truncate text-sm font-semibold text-ivory">{callerInfo?.display_name || 'Unknown caller'}</p>
            <p className="text-xs text-gold">Incoming call</p>
          </button>
          <button
            type="button"
            aria-label="Decline call"
            onClick={handleDecline}
            disabled={responding}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600 disabled:opacity-50"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative rounded-3xl border border-hairline bg-panel p-6 text-center shadow-2xl shadow-black/40">
        <button
          type="button"
          aria-label="Minimize incoming call"
          onClick={() => setIsMinimized(true)}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ivory/10 text-lg text-ivory transition hover:bg-ivory/20"
        >
          <span aria-hidden="true">−</span>
        </button>
        {callerInfo?.avatar_url && (
          <img
            src={callerInfo.avatar_url}
            alt={callerInfo.display_name}
            className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
          />
        )}

        <h2 className="text-2xl font-semibold text-ivory">
          {callerInfo?.display_name || 'Unknown caller'}
        </h2>

        <p className="mt-2 text-sm text-slate">
          {callType === 'video' ? '📹 Video call' : '☎️ Voice call'}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleDecline}
            disabled={responding}
            className="flex-1 rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
          >
            {responding ? 'Declining…' : 'Decline'}
          </button>

          <button
            onClick={handleAccept}
            disabled={responding}
            className="flex-1 rounded-2xl bg-green-500/20 px-4 py-3 text-sm font-semibold text-green-200 transition hover:bg-green-500/30 disabled:opacity-50"
          >
            {responding ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
