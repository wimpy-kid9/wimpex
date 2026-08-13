/**
 * WebRTC Calling Configuration
 * Settings for self-hosted peer-to-peer calling infrastructure
 */

export interface ICEServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface RTCConfig {
  iceServers: ICEServerConfig[];
  iceCandidatePoolSize: number;
}

/**
 * Get RTCConfiguration for peer connections
 * Includes STUN servers for NAT traversal
 * TURN servers should be configured via environment variables
 */
export function getRTCConfig(): RTCConfig {
  const stunServers: ICEServerConfig = {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302'
    ]
  };

  const iceServers: ICEServerConfig[] = [stunServers];

  // Add TURN server if configured
  if (
    process.env.NEXT_PUBLIC_TURN_URL &&
    process.env.NEXT_PUBLIC_TURN_USERNAME &&
    process.env.NEXT_PUBLIC_TURN_CREDENTIAL
  ) {
    iceServers.push({
      urls: [process.env.NEXT_PUBLIC_TURN_URL],
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    });
  }

  return {
    iceServers,
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
