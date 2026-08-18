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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-3xl border border-hairline bg-panel p-6 text-center shadow-2xl shadow-black/40">
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
