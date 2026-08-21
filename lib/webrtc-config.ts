/**
 * WebRTC Calling Configuration
 * Settings for self-hosted peer-to-peer calling infrastructure
 */

import { authedFetch } from '@/lib/api-client';

export interface ICEServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface RTCConfig {
  iceServers: ICEServerConfig[];
  iceCandidatePoolSize: number;
}

const FALLBACK_STUN_SERVERS: ICEServerConfig = {
  urls: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun3.l.google.com:19302',
    'stun:stun4.l.google.com:19302'
  ]
};

/**
 * Get RTCConfiguration for peer connections.
 *
 * TURN credentials (from Xirsys) are short-lived, so they're fetched fresh
 * from /api/calls/turn-credentials on every call setup rather than baked
 * into the client bundle via NEXT_PUBLIC_* env vars. That route also keeps
 * the Xirsys account secret server-side only.
 *
 * Falls back to STUN-only if the request fails, so calls between devices on
 * the same network still work even if TURN is temporarily unavailable.
 */
export async function getRTCConfig(): Promise<RTCConfig> {
  try {
    const response = await authedFetch('/api/calls/turn-credentials');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        return {
          iceServers: data.iceServers,
          iceCandidatePoolSize: data.iceCandidatePoolSize ?? 10
        };
      }
    }
  } catch (err) {
    console.error('Failed to fetch TURN credentials, falling back to STUN-only:', err);
  }

  return {
    iceServers: [FALLBACK_STUN_SERVERS],
    iceCandidatePoolSize: 10
  };
}

export interface CallSession {
  id: string;
  initiatorId: string;
  recipientId: string;
  status: 'pending' | 'active' | 'ended';
  startedAt: Date;
  endedAt?: Date;
}

export interface SignalingMessage {
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'call-initiated'
    | 'call-accepted'
    | 'call-declined'
    | 'call-ended';
  from: string;
  to: string;
  sessionId: string;
  data?: any;
  timestamp: number;
}