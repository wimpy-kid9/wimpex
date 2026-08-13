import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { post_id, interaction_type, watch_ms } = body;

  if (!post_id || !interaction_type) {
    return NextResponse.json(
      { error: 'post_id and interaction_type are required' },
      { status: 400 }
    );
  }

  const validTypes = ['view', 'watch_complete', 'like', 'comment', 'share', 'skip'];
  if (!validTypes.includes(interaction_type)) {
    return NextResponse.json(
      { error: 'Invalid interaction_type' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseServer
      .from('wpx_user_post_interactions')
      .insert({
        user_id: authContext.user.id,
        post_id,
        interaction_type,
        watch_ms: watch_ms || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ interaction: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to log interaction' },
      { status: 500 }
    );
  }
}
