import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

// POST /api/stories/view — records that the current user watched a story.
// Idempotent: viewing the same story twice just updates viewed_at.
export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ ok: true });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const storyId = body.story_id?.toString();
  if (!storyId) {
    return NextResponse.json({ error: 'story_id is required.' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('wpx_story_views')
    .upsert({ story_id: storyId, viewer_id: authContext.user.id, viewed_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}