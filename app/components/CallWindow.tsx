'use client';

import { useEffect, useRef, useState } from 'react';
import { getRTCConfig } from '@/lib/webrtc-config';

export interface CallProps {
  roomUrl: string;
  userName?: string;
  onClose: () => void;
}

/**
 * CallWindow component for WebRTC peer-to-peer video calls
 */
export default function CallWindow({ roomUrl, userName, onClose }: CallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState('connecting');

  useEffect(() => {
    const initializeCall = async () => {
      try {
        // Get user media
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        // Display local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Create peer connection
        const rtcConfig = getRTCConfig();
        const peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = peerConnection;

        // Add local stream tracks
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });

        // Handle remote stream
        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Monitor connection state
        peerConnection.onconnectionstatechange = () => {
          setConnectionState(peerConnection.connectionState);
          if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            setError('Call connection lost');
          }
        };

        // Create data channel for signaling
        const dataChannel = peerConnection.createDataChannel('signal', { ordered: true });
        setupDataChannel(dataChannel);

        peerConnection.ondatachannel = (event) => {
          setupDataChannel(event.channel);
        };

        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // In a real implementation, this would be sent to the signaling server
        // For now, we'll just indicate the call is established
        console.log('WebRTC call offer created', roomUrl);

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize call');
        setLoading(false);
      }
    };

    const setupDataChannel = (dataChannel: RTCDataChannel) => {
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (event) => {
        console.log('Message from peer:', event.data);
      };
      dataChannel.onopen = () => {
        console.log('Data channel opened');
      };
    };

    void initializeCall();

    return () => {
      peerConnectionRef.current?.close();
      localVideoRef.current?.srcObject && 
        ((localVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop()));
    };
  }, [roomUrl]);

  const handleLeaveCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localVideoRef.current?.srcObject) {
      (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="h-full w-full" ref={containerRef}>
        {loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-ivory">Initializing WebRTC call…</p>
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
          <div className="relative h-full w-full">
            {/* Remote video (main) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />

            {/* Local video (picture-in-picture) */}
            <div className="absolute bottom-4 right-4 h-32 w-48 overflow-hidden rounded-lg border-2 border-ivory shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            </div>

            {/* Connection status */}
            <div className="absolute top-4 left-4 rounded-lg bg-black/60 px-3 py-2 text-sm text-ivory">
              {connectionState === 'connecting' && <span>Connecting…</span>}
              {connectionState === 'connected' && <span className="text-emerald-300">Connected</span>}
              {connectionState === 'disconnected' && <span className="text-rose-300">Disconnected</span>}
            </div>

            {/* Leave button */}
            <button
              onClick={handleLeaveCall}
              className="absolute bottom-4 left-4 rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white hover:bg-rose-600"
            >
              Leave Call
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
