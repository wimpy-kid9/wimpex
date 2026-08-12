import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`;
  const response = await fetch(searchUrl);

  if (!response.ok) {
    const payload = await response.text();
    return NextResponse.json({ error: `Audio provider search failed: ${response.status} ${payload}` }, { status: 500 });
  }

  const data = await response.json();
  const tracks = (data.results || []).map((item: any) => ({
    id: item.trackId?.toString() || `${item.artistId}-${item.trackName}`,
    title: item.trackName || item.collectionName || 'Unknown title',
    artist: item.artistName || 'Unknown artist',
    album: item.collectionName || 'Unknown album',
    preview_url: item.previewUrl || null,
    cover_art_url: item.artworkUrl100?.replace(/100x100bb.jpg$/, '600x600bb.jpg') || item.artworkUrl60 || null,
    duration_ms: typeof item.trackTimeMillis === 'number' ? item.trackTimeMillis : null
  }));

  return NextResponse.json({ tracks });
}
