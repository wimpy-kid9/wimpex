'use client';

import { useEffect, useRef, useState } from 'react';

export interface CallProps {
  roomUrl: string;
  userName?: string;
  onClose: () => void;
}

/**
 * CallWindow component for embedding Daily.co video calls
 */
export default function CallWindow({ roomUrl, userName, onClose }: CallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    // Load Daily SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.daily.co/daily-js.js';
    script.async = true;

    script.onload = () => {
      if (!containerRef.current) return;

      const callFrame = (window as any).DailyIframe?.createFrame({
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none'
        },
        showLeaveButton: true,
        showFullscreenButton: true,
        theme: {
          colors: {
            accent: '#f59e0b',
            background: '#0f0f23'
          }
        }
      });

      if (!callFrame) {
        setError('Failed to initialize call frame');
        return;
      }

      // Join room
      callFrame.join({ url: roomUrl, userName: userName || 'Guest' });

      // Mount frame
      if (containerRef.current) {
        containerRef.current.appendChild(callFrame.iframe);
      }

      // Handle leave
      callFrame.on('left-meeting', () => {
        onClose();
      });

      setLoading(false);
    };

    script.onerror = () => {
      setError('Failed to load calling service');
      setLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [roomUrl, userName, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="h-full w-full">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-ivory">Connecting to call…</p>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-rose-200">{error}</p>
            <button
              onClick={onClose}
              className="rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-obsidian transition hover:bg-gold-deep"
            >
              Close
            </button>
          </div>
        )}

        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
