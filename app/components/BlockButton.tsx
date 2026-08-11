"use client";

import { useState } from 'react';
import { authedFetch } from '@/lib/api-client';

export default function BlockButton({ userId }: { userId: string }) {
  const [blocked, setBlocked] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const blockUser = async () => {
    setLoading(true);
    setStatus('');
    try {
      const response = await authedFetch('/api/blocks', {
        method: 'POST',
        body: JSON.stringify({ blocked_user_id: userId })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload.error || 'Unable to block user.');
      } else {
        setBlocked(true);
        setStatus('User blocked.');
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to block user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={blockUser}
        disabled={blocked || loading}
        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${blocked ? 'bg-rose-500/20 text-rose-200' : 'bg-ivory/5 text-ivory hover:bg-ivory/10'}`}
      >
        {blocked ? 'Blocked' : 'Block user'}
      </button>
      {status ? <p className="text-xs text-slate">{status}</p> : null}
    </div>
  );
}
