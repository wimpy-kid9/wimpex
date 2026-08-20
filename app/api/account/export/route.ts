import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isUserGold(authContext.user.id))) {
    return NextResponse.json({ error: 'Gold membership is required for data export.' }, { status: 403 });
  }

  const userId = authContext.user.id;
  const [{ data: profile }, { data: posts }, { data: messages }, { data: notifications }] = await Promise.all([
    supabaseServer.from('wpx_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabaseServer.from('wpx_posts').select('*').eq('author_id', userId).order('created_at', { ascending: false }),
    supabaseServer.from('wpx_messages').select('*').eq('sender_id', userId).order('created_at', { ascending: false }),
    supabaseServer.from('wpx_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  ]);

  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), profile, posts: posts || [], messages: messages || [], notifications: notifications || [] }, null, 2);
  return new NextResponse(payload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="wimpex-export-${userId}.json"`,
      'Cache-Control': 'no-store'
    }
  });
}
