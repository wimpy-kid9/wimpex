'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';
import { getUserAccent } from '@/lib/ui-theme';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';
import { useCalling } from '@/lib/use-calling';

type ConnectionRecord = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  peer_id?: string;
  peer_username?: string | null;
  peer_display_name?: string | null;
  peer_avatar_url?: string | null;
};

const statusStyles: Record<string, string> = {
  ringing: 'bg-gold/15 text-gold',
  active: 'bg-emerald-500/15 text-emerald-300',
  ended: 'bg-panel-2/15 text-slate',
  missed: 'bg-rose-500/15 text-rose-300',
  declined: 'bg-rose-500/15 text-rose-300'
};

export default function CallsPage() {
  const [session, setSession] = useState<any | null | undefined>(undefined);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'ready' | 'blocked'>('idle');
  const [permissionMessage, setPermissionMessage] = useState('');
  
  // Use calling hook for WebRTC state management
  const calling = useCalling(session?.user?.id);
  const accent = getUserAccent(session?.user?.id ?? 'wimpex');

  // Peer name lookup built from accepted connections, reused to resolve
  // "who was this call with" in Recent calls below (which previously
  // showed no identity for the other party at all).
  const peerProfileById = useMemo(() => {
    const map = new Map<string, { name: string; username: string | null }>();
    connections.forEach((connection) => {
      if (!connection.peer_id) return;
      map.set(connection.peer_id, {
        name: connection.peer_display_name || connection.peer_username || 'WIMPEX user',
        username: connection.peer_username || null
      });
    });
    return map;
  }, [connections]);

  useEffect(() => {
    const init = async () => {
      const result = await supabase.auth.getSession();
      const sessionData = result?.data?.session ?? null;
      setSession(sessionData);

      if (sessionData?.access_token) {
        // Load connections
        try {
          const response = await authedFetch('/api/connections');
          const payload = await response.json().catch(() => ({ connections: [] }));
          setConnections((payload.connections ?? []).filter((connection: ConnectionRecord) => connection.status === 'accepted'));
        } catch (err) {
          console.error('Error loading connections:', err);
        }
      }
    };

    void init();
  }, []);

  const startCall = useCallback(
    async (connection: ConnectionRecord) => {
      if (!session?.user?.id || busy) return;

      setBusy(true);

      try {
        const recipientId = connection.peer_id || (connection.requester_id === session.user.id ? connection.recipient_id : connection.requester_id);
        await calling.initiateCall(recipientId, 'video');
      } catch (err) {
        console.error('Error starting call:', err);
        setPermissionState('blocked');
        setPermissionMessage(err instanceof Error ? err.message : 'Enable camera and microphone permissions in device Settings.');
      } finally {
        setBusy(false);
      }
    },
    [session?.user?.id, busy, calling]
  );

  const endActiveCall = useCallback(async () => {
    if (!calling.activeCall?.id) return;
    try {
      await calling.endCall(calling.activeCall.id);
    } catch (err) {
      console.error('Error ending call:', err);
    }
  }, [calling]);

  // Lets the caller back out of a call the callee hasn't answered yet.
  const cancelOutgoingCall = useCallback(async () => {
    if (!calling.outgoingCall?.id) return;
    try {
      await calling.endCall(calling.outgoingCall.id);
    } catch (err) {
      console.error('Error cancelling call:', err);
    }
  }, [calling]);

  if (session === undefined) {
    return (
      <main className="min-h-[70vh] px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate">Loading call settings…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthActionPrompt
        title="Sign in to join calls"
        description="Call creation and joining require a WimpyID session."
      />
    );
  }

  return (
    <>
      {/* Calls page UI */}
      <main className="space-y-6 p-4 sm:p-8">
        <section className={`rounded-md border border-hairline bg-panel-2/80 p-6 text-ivory shadow-2xl ${accent.glow}`}>
          <div className={`rounded-md bg-gradient-to-r ${accent.gradient} p-[1px]`}>
            <div className="rounded-md bg-panel/90 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-slate">Live calling</p>
                  <h1 className="text-display text-3xl text-ivory">Calls</h1>
                </div>
                <div className={`rounded-full border border-hairline bg-gradient-to-r ${accent.gradient} px-3 py-1 text-sm font-medium text-obsidian`}>
                  {permissionState === 'ready' ? 'Mic + camera ready' : permissionState === 'requesting' ? 'Asking for access…' : permissionState === 'blocked' ? 'Permissions blocked' : 'Ready to connect'}
                </div>
              </div>
              {permissionMessage ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  <span>{permissionMessage}</span>
                  <button type="button" onClick={() => window.open('app-settings:', '_system')} className="rounded-full border border-rose-200/30 px-3 py-1 font-semibold hover:bg-rose-200/10">Open Settings</button>
                </div>
              ) : null}
              <p className="mt-3 max-w-2xl text-sm text-slate">WebRTC-based peer-to-peer calling with end-to-end encryption. Start a call with an accepted connection and connect directly.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-md border border-hairline bg-panel/70 p-6 text-ivory">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-ivory">Available connections</h2>
              <span className="rounded-full border border-hairline px-3 py-1 text-xs text-slate">Accepted only</span>
            </div>

            {connections.length === 0 ? (
              <p className="mt-4 text-sm text-slate">You need an accepted connection before placing a call.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {connections.map((connection) => {
                  const peerName = connection.peer_display_name || connection.peer_username || 'WIMPEX user';
                  return (
                    <li key={connection.id} className="flex items-center justify-between rounded-2xl border border-hairline bg-panel-2/70 px-4 py-3">
                      <div>
                        <p className="font-medium text-ivory">{peerName}</p>
                        <p className="text-xs text-slate">{connection.peer_username ? `@${connection.peer_username}` : 'Connected via WIMPEX'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void startCall(connection)}
                        className={`rounded-2xl bg-gradient-to-r ${accent.gradient} px-4 py-2 text-sm font-semibold text-obsidian transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                        disabled={busy || calling.isLoading}
                      >
                        {busy || calling.isLoading ? 'Starting…' : 'Start call'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-md border border-hairline bg-panel/70 p-6 text-ivory">
            <h2 className="text-xl font-semibold text-ivory">Call status</h2>
            <p className="mt-2 text-sm text-slate">Mic and camera are requested when you start or join a call.</p>

            <div className="mt-4 h-[340px] overflow-hidden rounded-md border border-hairline bg-panel-2/70 p-2">
              {calling.activeCall ? (
                <div className="flex h-full flex-col gap-2">
                  <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-hairline text-center">
                    <p className="text-sm text-slate">WebRTC peer-to-peer call in progress</p>
                    <p className="mt-2 text-xs text-slate">{calling.activeCall.call_type} • {calling.activeCall.status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void endActiveCall()}
                    className={`rounded-2xl border border-hairline bg-gradient-to-r ${accent.gradient} px-3 py-2 text-sm font-semibold text-obsidian transition hover:brightness-110`}
                  >
                    Leave call
                  </button>
                </div>
              ) : calling.outgoingCall ? (
                <div className="flex h-full flex-col gap-2">
                  <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-hairline text-center">
                    <p className="text-sm text-slate">Ringing…</p>
                    <p className="mt-2 text-xs text-slate">{calling.outgoingCall.call_type} • waiting for pickup</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void cancelOutgoingCall()}
                    className="rounded-2xl border border-hairline bg-panel-2/70 px-3 py-2 text-sm font-semibold text-ivory transition hover:bg-panel-2"
                  >
                    Cancel call
                  </button>
                </div>
              ) : calling.incomingCall ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-hairline text-center text-sm text-slate">
                  <div>
                    <p>Incoming {calling.incomingCall.call_type} call…</p>
                    <p className="mt-2 text-xs text-gold">Check notification at top of page</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-hairline text-sm text-slate">
                  Start or join a call to begin WebRTC peer-to-peer connection.
                </div>
              )}
            </div>

            {calling.error ? <p className="mt-3 text-sm text-rose-200">{calling.error}</p> : null}
          </div>
        </section>

        <section className="rounded-md border border-hairline bg-panel/70 p-6 text-ivory">
          <h2 className="text-xl font-semibold text-ivory">Recent calls</h2>
          {calling.callHistory.length === 0 ? (
            <p className="mt-3 text-sm text-slate">No calls recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {calling.callHistory.map((call) => {
                const peerId = call.caller_id === session?.user?.id ? call.callee_id : call.caller_id;
                const peer = peerProfileById.get(peerId);
                return (
                  <li key={call.id} className="flex flex-col gap-3 rounded-2xl border border-hairline bg-panel-2/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-ivory">
                        {peer ? peer.name : `${peerId.slice(0, 8)}…`} — {call.call_type} call
                      </p>
                      <p className="mt-1 text-sm text-slate">
                        {new Date(call.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[call.status] || 'bg-slate/15 text-slate'}`}>
                      {call.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
