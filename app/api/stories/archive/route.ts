import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { data, error } = await supabaseServer
    .from('wpx_stories')
    .select('id, media_type, video_url, image_url, thumbnail_url, caption, text_content, background_color, font, created_at, expires_at')
    .eq('author_id', authContext.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stories: data || [] });
}