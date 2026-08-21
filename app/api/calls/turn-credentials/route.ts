import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

/**
 * Returns ICE server credentials (STUN + TURN) for the calling client.
 *
 * TURN credentials come from Xirsys and are fetched server-side on every
 * request so the Xirsys account secret never reaches the browser bundle.
 * Xirsys issues short-lived (time-limited) TURN username/credential pairs
 * via its PUT /_turn/{channel} endpoint, authenticated with HTTP Basic auth
 * using XIRSYS_IDENT:XIRSYS_SECRET.
 *
 * Falls back to STUN-only if Xirsys isn't configured or the request fails,
 * so calling still works on matching networks even if TURN is down.
 */

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302'
];

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const iceServers: { urls: string[]; username?: string; credential?: string }[] = [
    { urls: STUN_SERVERS }
  ];

  const ident = process.env.XIRSYS_IDENT;
  const secret = process.env.XIRSYS_SECRET;
  const channel = process.env.XIRSYS_CHANNEL;

  if (ident && secret && channel) {
    try {
      const auth = Buffer.from(`${ident}:${secret}`).toString('base64');
      const xirsysResponse = await fetch(`https://global.xirsys.net/_turn/${channel}`, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ format: 'urls' })
      });

      if (xirsysResponse.ok) {
        const data = await xirsysResponse.json();
        const iceServer = data?.v?.iceServers;
        if (iceServer) {
          const urls = Array.isArray(iceServer.urls) ? iceServer.urls : [iceServer.urls];
          iceServers.push({
            urls,
            username: iceServer.username,
            credential: iceServer.credential
          });
        }
      } else {
        console.error('Xirsys TURN request failed:', xirsysResponse.status, await xirsysResponse.text());
      }
    } catch (err) {
      console.error('Error fetching Xirsys TURN credentials:', err);
    }
  }

  return NextResponse.json({ iceServers, iceCandidatePoolSize: 10 });
}