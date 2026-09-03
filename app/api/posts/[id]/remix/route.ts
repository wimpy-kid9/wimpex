import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isUserGold } from '@/lib/gold';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!(await isUserGold(authContext.user.id))) return NextResponse.json({ error: 'Gold membership is required for duets and stitches.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const remixType = body.type === 'stitch' ? 'stitch' : body.type === 'duet' ? 'duet' : null;
  if (!remixType) return NextResponse.json({ error: 'Remix type must be duet or stitch.' }, { status: 400 });
  const { data: source } = await supabaseServer.from('wpx_posts').select('id, video_url, image_url, caption, visibility, status').eq('id', params.id).eq('status', 'published').maybeSingle();
  if (!source || source.visibility !== 'public') return NextResponse.json({ error: 'Public source post not found.' }, { status: 404 });
  const { data, error } = await supabaseServer.from('wpx_posts').insert({
    author_id: authContext.user.id,
    caption: `Remix of: ${source.caption || 'WIMPEX post'}`,
    visibility: 'public',
    status: 'draft',
    media_type: 'video',
    repost_of: source.id,
    remix_type: remixType,
    remix_source_url: source.video_url || source.image_url || null
  }).select('id, repost_of, remix_type, remix_source_url, status').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data }, { status: 201 });
}