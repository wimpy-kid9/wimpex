import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const body = await request.json();
    const { reported_user_id, reported_post_id, report_type, reason, details } = body;

    if (!reported_user_id && !reported_post_id) {
      return NextResponse.json({ error: 'A reported user or post is required.' }, { status: 400 });
    }

    const { error } = await supabaseServer.from('wpx_reports').insert({
      reporter_id: authContext.user.id,
      reported_user_id,
      reported_post_id,
      report_type: report_type || 'content',
      reason: reason || 'Inappropriate content',
      details: details || null,
      status: 'pending'
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
