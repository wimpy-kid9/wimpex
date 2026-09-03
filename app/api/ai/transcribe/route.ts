import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  try { await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const endpoint = process.env.WIMPYAI_TRANSCRIBE_URL;
  if (!endpoint) return NextResponse.json({ error: 'Transcription is not configured. Set WIMPYAI_TRANSCRIBE_URL.' }, { status: 503 });
  const formData = await request.formData();
  const media = formData.get('media');
  const mode = formData.get('mode')?.toString() === 'captions' ? 'captions' : 'transcription';
  if (!media || typeof media === 'string' || !('arrayBuffer' in media)) return NextResponse.json({ error: 'Media file is required.' }, { status: 400 });

  const upstreamForm = new FormData();
  upstreamForm.append('media', media);
  upstreamForm.append('mode', mode);
  const response = await fetch(endpoint, { method: 'POST', body: upstreamForm });
  const text = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { payload = { text }; }
  return NextResponse.json(payload, { status: response.status });
}