import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

async function userId(request: NextRequest) {
  try { return (await requireAuth(request)).user.id; } catch { return null; }
}

export async function GET(request: NextRequest) {
  const id = await userId(request);
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseServer.from('wpx_story_highlights').select('id, story_id, title, created_at, story:wpx_stories(*)').eq('user_id', id).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ highlights: data || [] });
}

export async function POST(request: NextRequest) {
  const id = await userId(request);
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const storyId = typeof body.story_id === 'string' ? body.story_id : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 40) : '';
  if (!storyId || !title) return NextResponse.json({ error: 'Story and highlight title are required.' }, { status: 400 });
  const { data: story } = await supabaseServer.from('wpx_stories').select('id').eq('id', storyId).eq('author_id', id).maybeSingle();
  if (!story) return NextResponse.json({ error: 'Story not found.' }, { status: 404 });
  const { data, error } = await supabaseServer.from('wpx_story_highlights').upsert({ user_id: id, story_id: storyId, title }, { onConflict: 'user_id,story_id' }).select('id, story_id, title, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ highlight: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = await userId(request);
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const highlightId = request.nextUrl.searchParams.get('id');
  if (!highlightId) return NextResponse.json({ error: 'Highlight id is required.' }, { status: 400 });
  const { error } = await supabaseServer.from('wpx_story_highlights').delete().eq('id', highlightId).eq('user_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}