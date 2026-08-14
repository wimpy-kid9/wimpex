'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

export interface ShareSheetProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  onShared?: () => void;
}

export default function ShareSheet({ postId, isOpen, onClose, onShared }: ShareSheetProps) {
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnections, setSelectedConnections] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (!isOpen) return;

    const loadConnections = async () => {
      setLoadingConnections(true);
      try {
        const response = await authedFetch('/api/connections');
        if (!response.ok) {
          setConnections([]);
          return;
        }
        const payload = await response.json();
        setConnections(payload.connections || []);
      } catch (err) {
        console.error('Error loading connections:', err);
        setConnections([]);
      } finally {
        setLoadingConnections(false);
      }
    };

    void loadConnections();
  }, [isOpen]);

  const handleConnectionToggle = (userId: string) => {
    const newSelected = new Set(selectedConnections);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedConnections(newSelected);
  };

  const handleShareWithConnections = async () => {
    if (selectedConnections.size === 0) return;

    setSending(true);
    setShareStatus('sending');

    try {
      const recipients = Array.from(selectedConnections);

      // Send share message to each connection, and actually check the
      // response — previously this loop never inspected response.ok, so a
      // failed share (e.g. a missing recipientId, which was always the
      // case before peer_id existed) still fell through to "Shared! ✓".
      const results = await Promise.all(
        recipients.map((recipientId) =>
          authedFetch('/api/messages/share', {
            method: 'POST',
            body: JSON.stringify({ postId, recipientId })
          }).then((res) => res.ok)
        )
      );

      if (results.every((ok) => !ok)) {
        throw new Error('Failed to share with any selected connection');
      }

      // Increment share count
      await authedFetch('/api/posts/share', {
        method: 'POST',
        body: JSON.stringify({ postId })
      });

      setShareStatus('sent');
      onShared?.();
      setTimeout(() => {
        onClose();
        setShareStatus('idle');
        setSelectedConnections(new Set());
      }, 1500);
    } catch (err) {
      console.error('Error sharing:', err);
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2000);
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(postUrl);
      setShareStatus('sent');

      // Increment share count
      await authedFetch('/api/posts/share', {
        method: 'POST',
        body: JSON.stringify({ postId })
      });
      onShared?.();

      setTimeout(() => {
        onClose();
        setShareStatus('idle');
      }, 1500);
    } catch (err) {
      console.error('Error copying link:', err);
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl border border-b-0 border-hairline bg-panel p-6 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-ivory">Share this video</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition hover:bg-panel-2"
          >
            ✕
          </button>
        </div>

        {shareStatus === 'sent' ? (
          <div className="rounded-3xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-center text-sm text-green-200">
            Shared! ✓
          </div>
        ) : shareStatus === 'error' ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
            Error sharing. Try again.
          </div>
        ) : (
          <>
            {/* Copy Link Option */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="mb-4 w-full rounded-2xl border border-hairline bg-gold/10 px-4 py-3 text-center transition hover:bg-gold/15"
            >
              <p className="font-semibold text-gold">Copy Link</p>
              <p className="text-xs text-slate">Copy shareable link to clipboard</p>
            </button>

            {/* Send to Connections */}
            <div className="mb-4">
              <p className="mb-3 font-semibold text-ivory">Send to connections</p>

              {loadingConnections ? (
                <p className="text-sm text-slate">Loading connections…</p>
              ) : connections.length === 0 ? (
                <p className="text-sm text-slate">No connections to share with.</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-hairline bg-panel-2/50 p-3">
                  {connections.map((connection) => (
                    <label
                      key={connection.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl p-2 transition hover:bg-panel/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedConnections.has(connection.peer_id)}
                        onChange={() =>
                          handleConnectionToggle(connection.peer_id)
                        }
                        className="rounded border-hairline"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-ivory">
                          {connection.peer_display_name || connection.peer_username || 'WIMPEX user'}
                        </p>
                        {connection.peer_username ? (
                          <p className="text-xs text-slate">
                            @{connection.peer_username}
                          </p>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedConnections.size > 0 && (
                <button
                  type="button"
                  onClick={handleShareWithConnections}
                  disabled={sending}
                  className="mt-3 w-full rounded-2xl bg-gold/20 px-4 py-3 font-semibold text-gold transition hover:bg-gold/25 disabled:opacity-50"
                >
                  {sending ? 'Sending…' : `Send to ${selectedConnections.size} ${selectedConnections.size === 1 ? 'person' : 'people'}`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
