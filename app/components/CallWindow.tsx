'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getRTCConfig } from '@/lib/webrtc-config';
import { authedFetch } from '@/lib/api-client';

export interface CallProps {
  roomUrl: string;
  userName?: string;
  /** 'voice' renders the audio-call layout, 'video' renders the fullscreen video layout. */
  callType?: 'voice' | 'video';
  /** The other participant's user id, used to look up their name/avatar. */
  peerId?: string;
  peerName?: string;
  peerAvatar?: string;
  onClose: () => void;
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
  onClick: (e: React.MouseEvent) => void;
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
 * Renders two layouts depending on `callType`:
 *  - 'voice': centered contact avatar, name, status/timer, encryption notice,
 *    and a pill-shaped control grid (speaker, upgrade-to-video, mute, end call).
 *  - 'video': fullscreen remote feed with a draggable-feeling local PIP thumbnail,
 *    a top bar (switch camera, add participant, encryption info) and a bottom
 *    control bar. Tapping the screen toggles the overlays.
 */
export default function CallWindow({ roomUrl, userName, callType = 'video', peerId, peerName, peerAvatar, onClose }: CallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
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
    const setupDataChannel = (dataChannel: RTCDataChannel) => {
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (event) => {
        console.log('Message from peer:', event.data);
      };
      dataChannel.onopen = () => {
        console.log('Data channel opened');
      };
    };

    const initializeCall = async () => {
      try {
        // Audio-only calls never request the camera.
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
        });

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

        const dataChannel = peerConnection.createDataChannel('signal', { ordered: true });
        setupDataChannel(dataChannel);

        peerConnection.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // In a real implementation, this would be sent to the signaling server.
        console.log('WebRTC call offer created', roomUrl);

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize call');
        setLoading(false);
      }
    };

    void initializeCall();

    return () => {
      peerConnectionRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [roomUrl, callType]);

  const handleLeaveCall = () => {
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
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
    // existing peer connection / local stream.
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const videoTrack = videoStream.getVideoTracks()[0];
      if (videoTrack) {
        stream.addTrack(videoTrack);
        peerConnectionRef.current?.addTrack(videoTrack, stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
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
    const remoteEl = remoteVideoRef.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (remoteEl?.setSinkId) {
      remoteEl.setSinkId(nextSpeakerOn ? 'default' : 'communications').catch(() => {});
    }
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
    return loading ? 'Connecting…' : 'Ringing…';
  };

  const displayName = peer?.display_name || userName || 'Unknown';
  const showVideoFeed = callType === 'video' && isVideoOn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian">
      <div className="h-full w-full">
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
          <div className="relative h-full w-full" onClick={handleScreenTap}>
            {showVideoFeed ? (
              <>
                {/* Fullscreen remote feed */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full bg-obsidian object-cover"
                />

                {/* Local video — floating thumbnail, top-right */}
                <div
                  className={`absolute right-4 h-32 w-24 overflow-hidden rounded-2xl border-2 border-ivory/80 shadow-lg transition-all duration-300 sm:h-40 sm:w-28 ${
                    controlsVisible ? 'top-24' : 'top-4'
                  }`}
                >
                  <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                </div>
              </>
            ) : (
              // Audio call layout: centered avatar, name, status, encryption notice
              <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-panel to-obsidian px-6 text-center">
                {peer?.avatar_url ? (
                  <img
                    src={peer.avatar_url}
                    alt={displayName}
                    className="h-36 w-36 rounded-full object-cover ring-4 ring-white/10"
                  />
                ) : (
                  <div className="grid h-36 w-36 place-items-center rounded-full bg-panel-2 text-5xl font-semibold text-slate ring-4 ring-white/10">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-display text-2xl text-ivory">{displayName}</h2>
                  <p className="mt-1 text-sm text-slate">{statusLabel()}</p>
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
