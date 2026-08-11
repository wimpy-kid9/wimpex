import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

const SPOTIFY_TOKEN_KEY = 'spotify_access_token';

async function fetchSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify client credentials are not configured.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Spotify auth failed: ${response.status} ${payload}`);
  }

  return response.json();
}

async function getCachedSpotifyToken() {
  if (!isSupabaseServerConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabaseServer
    .from('wpx_api_cache')
    .select('key, value, expires_at')
    .eq('key', SPOTIFY_TOKEN_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const now = new Date();
  if (data?.value && data.expires_at && new Date(data.expires_at) > now) {
    return JSON.parse(data.value);
  }

  const tokenResponse = await fetchSpotifyAccessToken();
  const expiresAt = new Date(now.getTime() + (tokenResponse.expires_in - 60) * 1000).toISOString();

  await supabaseServer.from('wpx_api_cache').upsert({
    key: SPOTIFY_TOKEN_KEY,
    value: JSON.stringify(tokenResponse),
    expires_at: expiresAt
  });

  return tokenResponse;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ tracks: [] });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  let tokenResponse;
  try {
    tokenResponse = await getCachedSpotifyToken();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const searchRes = await fetch(`https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(query)}`, {
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`
    }
  });

  if (!searchRes.ok) {
    const payload = await searchRes.text();
    return NextResponse.json({ error: `Spotify search failed: ${searchRes.status} ${payload}` }, { status: 500 });
  }

  const data = await searchRes.json();
  const tracks = (data.tracks?.items || []).map((track: any) => ({
    id: track.id,
    title: track.name,
    artist: track.artists?.map((artist: any) => artist.name).join(', ') || '',
    album: track.album?.name || '',
    preview_url: track.preview_url,
    cover_art_url: track.album?.images?.[0]?.url || null,
    uri: track.uri,
    duration_ms: track.duration_ms
  }));

  return NextResponse.json({ tracks });
}
