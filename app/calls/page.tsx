"use client";

import DailyIframe from '@daily-co/daily-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserAccent } from '@/lib/ui-theme';

type CallRecord = {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: string;
  status: string;
  room_id: string | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
};

type ConnectionRecord = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
};

const statusStyles: Record<string, string> = {
  ringing: 'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-slate-500/15 text-slate-300',
  missed: 'bg-rose-500/15 text-rose-300'
};

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [session, setSession] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [activeRoomUrl, setActiveRoomUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'ready' | 'blocked'>('idle');
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<any>(null);
  const timeoutRef = useRef<number | null>(null);

  const accent = getUserAccent(session?.user?.id ?? 'wimpex');

  const requestMediaPermissions = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    setPermissionState('requesting');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach((track) => track.stop());
    setPermissionState('ready');
  };

  const loadData = async (accessToken: string) => {
    const [callsResponse, connectionsResponse] = await Promise.all([
      fetch('/api/calls', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/connections', { headers: { Authorization: `Bearer ${accessToken}` } })
    ]);

    const callsPayload = await callsResponse.json().catch(() => ({ calls: [] }));
    const connectionsPayload = await connectionsResponse.json().catch(() => ({ connections: [] }));

    setCalls(callsPayload.calls ?? []);
    setConnections((connectionsPayload.connections ?? []).filter((connection: ConnectionRecord) => connection.status === 'accepted'));
  };

  const updateCallStatus = useCallback(async (callId: string, status: string) => {
    if (!session?.access_token) return;

    const response = await fetch('/api/calls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: callId, status })
    });

    const payload = await response.json().catch(() => ({}));
    if (payload.call) {
      setCalls((current) => current.map((call) => (call.id === callId ? { ...call, status: payload.call.status } : call)));
    }
  }, [session?.access_token]);

  useEffect(() => {
    const init = async () => {
      const result = await supabase.auth.getSession();
      const sessionData = result?.data?.session ?? null;
      setSession(sessionData);

      if (sessionData?.access_token) {
        await loadData(sessionData.access_token);
      }
    };

    void init();
  }, []);

  useEffect(() => {
    if (!activeRoomUrl || !frameContainerRef.current) {
      return;
    }

    if (frameRef.current) {
      frameRef.current.destroy?.();
      frameRef.current = null;
    }

    const frame = (DailyIframe as any).createFrame({
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        borderRadius: '24px'
      },
      showLeaveButton: true,
      parentNode: frameContainerRef.current
    });

    const currentCallId = activeCall?.id;

    frameRef.current = frame;
    frame.on('joined-meeting', async () => {
      if (currentCallId) {
        await updateCallStatus(currentCallId, 'active');
      }
    });

    frame.on('left-meeting', async () => {
      if (currentCallId) {
        await updateCallStatus(currentCallId, 'ended');
      }
    });

    void frame.join({ url: activeRoomUrl });

    return () => {
      frame.destroy?.();
      frameRef.current = null;
    };
  }, [activeCall?.id, activeRoomUrl, updateCallStatus]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      frameRef.current?.destroy?.();
    };
  }, []);

  const startCall = async (connection: ConnectionRecord) => {
    if (!session?.access_token) return;

    setBusy(true);
    setStatusMessage('Requesting mic and camera access…');

    try {
      await requestMediaPermissions();
    } catch {
      setPermissionState('blocked');
      setStatusMessage('Mic/camera access is blocked, but the room can still be opened.');
    }

    setStatusMessage('Creating a Daily room…');

    const recipientId = connection.requester_id === session.user.id ? connection.recipient_id : connection.requester_id;
    const response = await fetch('/api/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ callee_id: recipientId, connection_id: connection.id, call_type: 'video' })
    });

    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok || !payload.call) {
      setStatusMessage(payload.error || 'Unable to start the call right now.');
      return;
    }

    const nextCall = payload.call as CallRecord;
    setCalls((current) => [nextCall, ...current]);
    setActiveCall(nextCall);
    setActiveRoomUrl(nextCall.room_id);
    setStatusMessage('Room ready — join the call and grant mic/camera access when prompted.');

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      if (nextCall.status === 'ringing') {
        void updateCallStatus(nextCall.id, 'missed');
      }
    }, 20000);
  };

  const joinCall = async (call: CallRecord) => {
    setActiveCall(call);
    setStatusMessage('Requesting mic and camera access…');

    try {
      await requestMediaPermissions();
    } catch {
      setPermissionState('blocked');
      setStatusMessage('Mic/camera access is blocked, but the room can still be opened.');
    }

    setActiveRoomUrl(call.room_id ?? null);
    setStatusMessage('Connecting to the Daily room…');
  };

  const leaveCall = async () => {
    if (!activeCall?.id) return;
    await updateCallStatus(activeCall.id, 'ended');
    setActiveRoomUrl(null);
    setActiveCall(null);
    setStatusMessage('Call ended.');
  };

  return (
    <main className="space-y-6 p-4 sm:p-8">
      <section className={`rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 text-slate-100 shadow-2xl ${accent.glow}`}>
        <div className={`rounded-[1.5rem] bg-gradient-to-r ${accent.gradient} p-[1px]`}>
          <div className="rounded-[calc(1.5rem-1px)] bg-slate-950/90 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Live calling</p>
                <h1 className="text-display text-3xl text-white">Calls</h1>
              </div>
              <div className={`rounded-full border border-white/10 bg-gradient-to-r ${accent.gradient} px-3 py-1 text-sm font-medium text-slate-950`}>
                {permissionState === 'ready' ? 'Mic + camera ready' : permissionState === 'requesting' ? 'Asking for access…' : 'Ready to connect'}
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">Start a real Daily room with an accepted connection and join it from the same screen with a more polished, full-screen feel.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-slate-100">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Available connections</h2>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">Accepted only</span>
          </div>

          {connections.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">You need an accepted connection before placing a call.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {connections.map((connection) => {
                const recipientId = connection.requester_id === session?.user?.id ? connection.recipient_id : connection.requester_id;
                return (
                  <li key={connection.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3">
                    <div>
                      <p className="font-medium text-white">{recipientId.slice(0, 8)}…</p>
                      <p className="text-xs text-slate-400">Connected via WIMPEX</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void startCall(connection)}
                      className={`rounded-2xl bg-gradient-to-r ${accent.gradient} px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                      disabled={busy}
                    >
                      {busy ? 'Starting…' : 'Start call'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-slate-100">
          <h2 className="text-xl font-semibold text-white">Live room</h2>
          <p className="mt-2 text-sm text-slate-400">Mic and camera are requested as soon as you enter the room.</p>

          <div className="mt-4 h-[340px] overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-2">
            {activeRoomUrl ? (
              <div className="flex h-full flex-col gap-2">
                <div ref={frameContainerRef} className="h-full w-full rounded-[1.25rem]" />
                <button
                  type="button"
                  onClick={() => void leaveCall()}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-r ${accent.gradient} px-3 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110`}
                >
                  Leave call
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[1.25rem] border border-dashed border-slate-700 text-sm text-slate-400">
                Start or join a call to open the Daily frame.
              </div>
            )}
          </div>

          {statusMessage ? <p className="mt-3 text-sm text-amber-200">{statusMessage}</p> : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-slate-100">
        <h2 className="text-xl font-semibold text-white">Recent calls</h2>
        {calls.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No calls recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {calls.map((call) => (
              <li key={call.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">{call.call_type} call • {call.status}</p>
                  <p className="mt-1 text-sm text-slate-400">Room: {call.room_id || 'pending'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[call.status] || 'bg-slate-500/15 text-slate-300'}`}>
                    {call.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void joinCall(call)}
                    className={`rounded-2xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 ${accent.line}`}
                  >
                    Join
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
