import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ published: 0 });
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: due, error: loadError } = await supabaseServer
    .from('wpx_posts')
    .select('id')
    .eq('status', 'draft')
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', new Date().toISOString());
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const ids = (due || []).map((post: any) => post.id);
  if (!ids.length) return NextResponse.json({ published: 0 });
  const { error: publishError } = await supabaseServer
    .from('wpx_posts')
    .update({ status: 'published', scheduled_for: null, updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'draft');
  if (publishError) return NextResponse.json({ error: publishError.message }, { status: 500 });

  return NextResponse.json({ published: ids.length });
}
