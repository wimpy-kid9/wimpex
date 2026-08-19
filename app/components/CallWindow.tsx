'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getRTCConfig } from '@/lib/webrtc-config';
import { authedFetch } from '@/lib/api-client';

const CallAudio = registerPlugin<{
  stopRingtone: () => Promise<void>;
  prepareCallAudio: () => Promise<void>;
  releaseCallAudio: () => Promise<void>;
}>('CallAudio');

export interface CallProps {
  roomUrl: string;
  userName?: string;
  /** 'voice' renders the audio-call layout, 'video' renders the fullscreen video layout. */
  callType?: 'voice' | 'video';
  /** Whether this browser is the caller (creates the offer) or the callee (creates the answer). */
  isCaller: boolean;
  /** The other participant's user id, used to look up their name/avatar. */
  peerId?: string;
  peerName?: string;
  peerAvatar?: string;
  onClose: () => void;
}

// Plain structural alias for RTCIceCandidateInit — some ESLint/TS setups
// don't resolve the ambient DOM lib type when it's only ever used as a
// generic argument, so we spell out the shape locally instead.
type IceCandidateInit = {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

interface CallSignal {
  id: string;
  call_id: string;
  sender_id: string;
  signal_type: 'offer' | 'answer' | 'candidate';
  payload: any;
  created_at: string;
}

function IconButton({
  active,
  danger,
  large,
  label,
  onClick,
  children
}: {
  active?: boolean;
  danger?: boolean;
  large?: boolean;
  label: string;
  onClick: (_e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const size = large ? 'h-14 w-14' : 'h-12 w-12';
  const palette = danger
    ? 'bg-rose-500 text-white hover:bg-rose-600'
    : active
    ? 'bg-ivory text-obsidian hover:bg-ivory/90'
    : 'bg-white/15 text-ivory hover:bg-white/25';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid ${size} place-items-center rounded-full ${palette} backdrop-blur-xl transition`}
    >
      {children}
    </button>
  );
}

/**
 * CallWindow component for WebRTC peer-to-peer audio/video calls.
 *
 * Actually performs signaling now: the two browsers exchange SDP offer/answer
 * and ICE candidates through /api/calls/[id]/signal (backed by the
 * wpx_call_signals table), polled every ~1.2s. Previously each browser created
 * an RTCPeerConnection and a local offer in isolation and never sent it
 * anywhere, so the two sides could never actually connect and the UI sat on
 * "Connecting…" forever.
 *
 * Renders two layouts depending on `callType`:
 *  - 'voice': centered contact avatar, name, status/timer, encryption notice,
 *    and a pill-shaped control grid (speaker, upgrade-to-video, mute, end call).
 *  - 'video': fullscreen remote feed with a floating local PIP thumbnail,
 *    a top bar (switch camera, add participant, encryption info) and a bottom
 *    control bar. Tapping the screen toggles the overlays.
 */
export default function CallWindow({
  roomUrl,
  userName,
  callType = 'video',
  isCaller,
  peerId,
  peerName,
  peerAvatar,
  onClose
}: CallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSignalCursorRef = useRef<string | null>(null);
  const remoteDescriptionSetRef = useRef(false);
  const pendingCandidatesRef = useRef<IceCandidateInit[]>([]);
  const stoppedRef = useRef(false);
  const callSurfaceRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const pipDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pipPosition, setPipPosition] = useState<{ x: number; y: number } | null>(null);
  const [peer, setPeer] = useState<{ display_name?: string; avatar_url?: string } | null>(
    peerName || peerAvatar ? { display_name: peerName, avatar_url: peerAvatar } : null
  );

  // Look up the other participant's name/avatar if the caller didn't already pass them in.
  useEffect(() => {
    if (peer || !peerId) return;
    const loadPeer = async () => {
      try {
        const resp = await authedFetch(`/api/profile/${peerId}`);
        if (resp.ok) {
          const data = await resp.json();
          setPeer(data.profile || null);
        }
      } catch {
        // ignore — we'll fall back to userName
      }
    };
    void loadPeer();
  }, [peer, peerId]);

  // Call duration timer, starts once the peer connection reports 'connected'.
  useEffect(() => {
    if (connectionState === 'connected') {
      durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [connectionState]);

  useEffect(() => {
    if (!loading && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      void localVideoRef.current.play().catch(() => undefined);
    }
  }, [loading, isVideoOn]);

  useEffect(() => {
    stoppedRef.current = false;

    const sendSignal = async (signal_type: CallSignal['signal_type'], payload: any) => {
      try {
        await authedFetch(`/api/calls/${roomUrl}/signal`, {
          method: 'POST',
          body: JSON.stringify({ signal_type, payload })
        });
      } catch (err) {
        console.error('Failed to send signal', signal_type, err);
      }
    };

    const flushPendingCandidates = async (peerConnection: RTCPeerConnection) => {
      const queued = pendingCandidatesRef.current;
      pendingCandidatesRef.current = [];
      for (const candidate of queued) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add queued ICE candidate', err);
        }
      }
    };

    const handleIncomingSignal = async (peerConnection: RTCPeerConnection, signal: CallSignal) => {
      if (signal.signal_type === 'offer' && !isCaller) {
        if (remoteDescriptionSetRef.current) return;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
        remoteDescriptionSetRef.current = true;
        await flushPendingCandidates(peerConnection);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await sendSignal('answer', answer);
      } else if (signal.signal_type === 'answer' && isCaller) {
        if (remoteDescriptionSetRef.current) return;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
        remoteDescriptionSetRef.current = true;
        await flushPendingCandidates(peerConnection);
      } else if (signal.signal_type === 'candidate') {
        if (remoteDescriptionSetRef.current) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(signal.payload));
          } catch (err) {
            console.error('Failed to add ICE candidate', err);
          }
        } else {
          pendingCandidatesRef.current.push(signal.payload);
        }
      }
    };

    const pollSignals = async (peerConnection: RTCPeerConnection) => {
      try {
        const url = lastSignalCursorRef.current
          ? `/api/calls/${roomUrl}/signal?after=${encodeURIComponent(lastSignalCursorRef.current)}`
          : `/api/calls/${roomUrl}/signal`;
        const resp = await authedFetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        const signals: CallSignal[] = data.signals || [];
        for (const signal of signals) {
          await handleIncomingSignal(peerConnection, signal);
          lastSignalCursorRef.current = signal.created_at;
        }
      } catch (err) {
        console.error('Error polling call signals', err);
      }
    };

    // Requests the mic with a single retry if the OS reports the audio
    // hardware as busy (NotReadableError). On Android WebView this is
    // usually a transient race — nothing else should be holding audio focus
    // at this point since prepareCallAudio() is deliberately NOT called
    // until after this succeeds (see initializeCall below).
    const getAudioStream = async (): Promise<MediaStream> => {
      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      };

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.error(
          'audioinput devices found:',
          devices.filter((d) => d.kind === 'audioinput').length
        );
      } catch (enumErr) {
        console.error('enumerateDevices failed:', enumErr);
      }

      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (err?.name !== 'NotReadableError') throw err;
        console.error('NotReadableError acquiring mic, retrying once in 500ms');
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await navigator.mediaDevices.getUserMedia(constraints);
      }
    };

    const initializeCall = async () => {
      let pendingLocalStream: MediaStream | null = null;
      try {
        if (Capacitor.isNativePlatform()) await CallAudio.stopRingtone();

        // Android WebView is more reliable when the mic is opened by
        // Chromium's own audio session BEFORE the host app touches
        // AudioManager mode/focus. Calling prepareCallAudio() first was
        // found to conflict with Chromium's internal WebRTC audio session
        // setup and reliably threw NotReadableError, so we now acquire the
        // stream first and only manage native audio routing afterward.
        pendingLocalStream = await getAudioStream();

        if (callType === 'video') {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          cameraStream.getVideoTracks().forEach((track) => pendingLocalStream?.addTrack(track));
        }

        if (Capacitor.isNativePlatform()) {
          await CallAudio.prepareCallAudio().catch((focusErr) =>
            console.error('prepareCallAudio failed after mic was already open (non-fatal):', focusErr)
          );
        }

        if (stoppedRef.current) {
          pendingLocalStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const localStream = pendingLocalStream;
        localStreamRef.current = localStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        const rtcConfig = getRTCConfig();
        const peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = peerConnection;

        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Trickle ICE: publish every local candidate as it's discovered.
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            void sendSignal('candidate', event.candidate.toJSON());
          }
        };

        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          if (state === 'connected') {
            setConnectionState('connected');
          } else if (state === 'failed' || state === 'disconnected') {
            setConnectionState('disconnected');
            setError('Call connection lost');
          } else {
            setConnectionState('connecting');
          }
        };

        // Only the caller creates and sends the initial offer; the callee waits
        // for it to arrive over polling and responds with an answer.
        if (isCaller) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await sendSignal('offer', offer);
        }

        signalPollRef.current = setInterval(() => void pollSignals(peerConnection), 1200);
        void pollSignals(peerConnection);

        setLoading(false);
      } catch (err: any) {
        console.error('Call media initialization failed:', err?.name, err?.message);
        pendingLocalStream?.getTracks().forEach((track) => track.stop());
        if (Capacitor.isNativePlatform()) await CallAudio.releaseCallAudio().catch(() => undefined);
        setError(`${err?.name || 'Error'}: ${err?.message || 'Failed to initialize call'}`);
        setLoading(false);
      }
    };

    void initializeCall();

    return () => {
      stoppedRef.current = true;
      if (signalPollRef.current) clearInterval(signalPollRef.current);
      peerConnectionRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (Capacitor.isNativePlatform()) void CallAudio.releaseCallAudio();
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [roomUrl, callType, isCaller]);

  const handleLeaveCall = () => {
    stoppedRef.current = true;
    if (signalPollRef.current) clearInterval(signalPollRef.current);
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (Capacitor.isNativePlatform()) void CallAudio.releaseCallAudio();
    onClose();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleVideo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const stream = localStreamRef.current;
    if (!stream) return;

    if (isVideoOn) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
        stream.removeTrack(track);
      });
      setIsVideoOn(false);
      return;
    }

    // Upgrading a voice call to video: grab a camera track and add it to the
    // existing peer connection / local stream. renegotiateNeeded fires on the
    // peer connection, and our existing signaling loop (offer/answer via
    // /api/calls/[id]/signal) carries the updated SDP to the other side.
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        stream.addTrack(videoTrack);
        const sender = peerConnectionRef.current?.addTrack(videoTrack, stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (isCaller && peerConnectionRef.current) {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          await authedFetch(`/api/calls/${roomUrl}/signal`, {
            method: 'POST',
            body: JSON.stringify({ signal_type: 'offer', payload: offer })
          });
          remoteDescriptionSetRef.current = false;
        }
        void sender;
      }
      setIsVideoOn(true);
    } catch (err) {
      console.error('Unable to enable camera', err);
    }
  };

  const toggleSpeaker = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeakerOn = !isSpeakerOn;
    setIsSpeakerOn(nextSpeakerOn);
    // setSinkId is only supported in some browsers — route audio output when available,
    // otherwise this just reflects the user's intended state in the UI.
    const remoteEl = remoteVideoRef.current as (HTMLVideoElement & { setSinkId?: (_id: string) => Promise<void> }) | null;
    if (remoteEl?.setSinkId) {
      remoteEl.setSinkId(nextSpeakerOn ? 'default' : 'communications').catch(() => {});
    }
  };

  const handlePipPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const surfaceEl = callSurfaceRef.current;
    const pipEl = pipRef.current;
    if (!surfaceEl || !pipEl) return;
    const surfaceRect = surfaceEl.getBoundingClientRect();
    const pipRect = pipEl.getBoundingClientRect();
    const originX = pipPosition ? pipPosition.x : pipRect.left - surfaceRect.left;
    const originY = pipPosition ? pipPosition.y : pipRect.top - surfaceRect.top;
    pipDragRef.current = { startX: e.clientX, startY: e.clientY, originX, originY };
    pipEl.setPointerCapture(e.pointerId);
  };

  const handlePipPointerMove = (e: React.PointerEvent) => {
    if (!pipDragRef.current) return;
    e.stopPropagation();
    const surfaceEl = callSurfaceRef.current;
    const pipEl = pipRef.current;
    if (!surfaceEl || !pipEl) return;
    const surfaceRect = surfaceEl.getBoundingClientRect();
    const pipRect = pipEl.getBoundingClientRect();
    const dx = e.clientX - pipDragRef.current.startX;
    const dy = e.clientY - pipDragRef.current.startY;
    const maxX = Math.max(surfaceRect.width - pipRect.width, 0);
    const maxY = Math.max(surfaceRect.height - pipRect.height, 0);
    const nextX = Math.min(Math.max(pipDragRef.current.originX + dx, 0), maxX);
    const nextY = Math.min(Math.max(pipDragRef.current.originY + dy, 0), maxY);
    setPipPosition({ x: nextX, y: nextY });
  };

  const handlePipPointerUp = (e: React.PointerEvent) => {
    if (!pipDragRef.current) return;
    pipDragRef.current = null;
    pipRef.current?.releasePointerCapture(e.pointerId);
  };

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    if (callType === 'video' && isVideoOn) {
      hideControlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [callType, isVideoOn]);

  useEffect(() => {
    revealControls();
  }, [revealControls]);

  const handleScreenTap = () => {
    // Auto-hide only applies to the fullscreen video layout.
    if (callType !== 'video' || !isVideoOn) return;
    setControlsVisible((visible) => {
      const next = !visible;
      if (next) revealControls();
      return next;
    });
  };

  const formatDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const statusLabel = () => {
    if (connectionState === 'connected') return formatDuration(duration);
    if (connectionState === 'disconnected') return 'Call ended';
    return loading ? 'Connecting…' : isCaller ? 'Ringing…' : 'Connecting…';
  };

  const displayName = peer?.display_name || userName || 'Unknown';
  const showVideoFeed = callType === 'video' && isVideoOn;

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 w-64 rounded-2xl border border-hairline bg-panel/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:right-6">
        <div className="flex items-center gap-3">
          {peer?.avatar_url ? (
            <img src={peer.avatar_url} alt={displayName} className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-panel-2 text-lg font-semibold text-slate">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setIsMinimized(false)}>
            <p className="truncate text-sm font-semibold text-ivory">{displayName}</p>
            <p className="text-xs text-slate">{statusLabel()}</p>
          </button>
          <button
            type="button"
            aria-label="End call"
            onClick={handleLeaveCall}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian">
      <div className="h-full w-full">
        <button
          type="button"
          aria-label="Minimize call"
          onClick={(event) => {
            event.stopPropagation();
            setIsMinimized(true);
          }}
          className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-xl text-ivory backdrop-blur-xl transition hover:bg-black/65"
        >
          <span aria-hidden="true">−</span>
        </button>
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            {peer?.avatar_url ? (
              <img src={peer.avatar_url} alt={displayName} className="h-24 w-24 rounded-full object-cover ring-2 ring-white/10" />
            ) : null}
            <p className="text-ivory">{displayName !== 'Unknown' ? displayName : 'Starting call…'}</p>
            <p className="text-sm text-slate">Connecting…</p>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-rose-200">{error}</p>
            <button
              onClick={handleLeaveCall}
              className="rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-obsidian transition hover:bg-gold-deep"
            >
              Close
            </button>
          </div>
        )}

        {!loading && !error && (
          <div ref={callSurfaceRef} className="relative h-full w-full" onClick={handleScreenTap}>
            {/*
              Remote media element — always mounted, regardless of layout or
              whether the video track is on. Previously this <video> only
              existed inside the showVideoFeed branch, so on a voice call (or
              any time video was toggled off) there was nowhere for the
              incoming audio track to play: ontrack fired but
              remoteVideoRef.current was null, so remote audio was silently
              dropped. Keeping this element mounted at all times and only
              toggling its visibility fixes that.
            */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={showVideoFeed ? 'h-full w-full bg-obsidian object-cover' : 'hidden'}
            />

            {showVideoFeed ? (
              <>
                {/* Local video — draggable floating thumbnail, default top-right */}
                <div
                  ref={pipRef}
                  onPointerDown={handlePipPointerDown}
                  onPointerMove={handlePipPointerMove}
                  onPointerUp={handlePipPointerUp}
                  onPointerCancel={handlePipPointerUp}
                  onClick={(e) => e.stopPropagation()}
                  style={pipPosition ? { left: pipPosition.x, top: pipPosition.y, right: 'auto' } : undefined}
                  className={`absolute h-32 w-24 touch-none cursor-grab overflow-hidden rounded-2xl border-2 border-ivory/80 shadow-lg active:cursor-grabbing sm:h-40 sm:w-28 ${
                    pipPosition
                      ? ''
                      : `right-4 transition-all duration-300 ${controlsVisible ? 'top-24' : 'top-4'}`
                  }`}
                >
                  <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                </div>
              </>
            ) : (
              // Audio call layout: large centered avatar in the top half of the
              // screen, with name / status / encryption notice below it.
              <div className="flex h-full flex-col bg-gradient-to-b from-panel to-obsidian">
                <div className="flex h-1/2 items-center justify-center">
                  {peer?.avatar_url ? (
                    <img
                      src={peer.avatar_url}
                      alt={displayName}
                      className="h-40 w-40 rounded-full object-cover ring-4 ring-white/10 sm:h-48 sm:w-48"
                    />
                  ) : (
                    <div className="grid h-40 w-40 place-items-center rounded-full bg-panel-2 text-6xl font-semibold text-slate ring-4 ring-white/10 sm:h-48 sm:w-48">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col items-center gap-1 px-6 pt-2 text-center">
                  <h2 className="text-display text-2xl text-ivory">{displayName}</h2>
                  <p className="text-sm text-slate">{statusLabel()}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate/70">🔒 End-to-end encrypted</p>
                </div>
                {/* Local audio track lives here even though nothing is rendered visually */}
                <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
              </div>
            )}

            {/* Top bar — video calls only: switch camera, add participant, encryption info */}
            {showVideoFeed && (
              <div
                className={`absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-4 transition-opacity duration-300 ${
                  controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-ivory">{displayName}</p>
                  <p className="text-xs text-slate">
                    {statusLabel()} · 🔒 Encrypted
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label="Switch camera" onClick={(e) => e.stopPropagation()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M17 2l4 4-4 4" />
                      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                      <path d="M7 22l-4-4 4-4" />
                      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                    </svg>
                  </IconButton>
                  <IconButton label="Add participant" onClick={(e) => e.stopPropagation()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="16" y1="11" x2="22" y2="11" />
                    </svg>
                  </IconButton>
                </div>
              </div>
            )}

            {/* Bottom control grid: speaker, video toggle, mute, end call */}
            <div
              className={`absolute inset-x-0 bottom-0 flex justify-center px-4 pb-8 pt-6 transition-opacity duration-300 ${
                showVideoFeed
                  ? `bg-gradient-to-t from-black/70 to-transparent ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`
                  : 'opacity-100'
              }`}
            >
              <div className="flex items-center gap-3 rounded-full bg-black/50 px-4 py-3 backdrop-blur-xl sm:gap-4">
                <IconButton label={isSpeakerOn ? 'Turn speaker off' : 'Turn speaker on'} active={isSpeakerOn} onClick={toggleSpeaker}>
                  {isSpeakerOn ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  )}
                </IconButton>

                <IconButton label={isVideoOn ? 'Turn camera off' : 'Turn camera on'} active={isVideoOn} onClick={toggleVideo}>
                  {isVideoOn ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h4a2 2 0 0 1 2 2v3.5" />
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </IconButton>

                <IconButton label={isMuted ? 'Unmute microphone' : 'Mute microphone'} active={isMuted} onClick={toggleMute}>
                  {isMuted ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                      <path d="M19 10v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </IconButton>

                <IconButton label="End call" danger large onClick={(e) => { e.stopPropagation(); handleLeaveCall(); }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 rotate-[135deg]">
                    <path d="M12 2a10 10 0 0 0-8.5 15.2c.2.3.6.5 1 .4l3.6-.9c.4-.1.7-.5.7-.9v-2.2c0-.3-.1-.6-.4-.8-1-.8-1.8-1.9-2.2-3.1-.1-.4 0-.8.3-1.1L9 6.9c.3-.3.4-.7.2-1.1-.4-.9-.6-1.9-.6-2.9 0-.5-.4-.9-.9-.9H12z" />
                    <path d="M12 2a10 10 0 0 1 8.5 15.2c-.2.3-.6.5-1 .4l-3.6-.9c-.4-.1-.7-.5-.7-.9v-2.2c0-.3.1-.6.4-.8 1-.8 1.8-1.9 2.2-3.1.1-.4 0-.8-.3-1.1L15 6.9c-.3-.3-.4-.7-.2-1.1.4-.9.6-1.9.6-2.9 0-.5.4-.9.9-.9H12z" />
                  </svg>
                </IconButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}