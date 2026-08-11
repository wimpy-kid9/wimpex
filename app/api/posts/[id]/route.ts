import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseServer.from('wpx_posts').select('*').eq('id', postId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ post: data });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const postId = params.id;
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, any> = {};
  if (body.caption !== undefined) updates.caption = body.caption;
  if (body.visibility !== undefined) updates.visibility = body.visibility;

  const { data: existing, error: existingError } = await supabaseServer.from('wpx_posts').select('author_id').eq('id', postId).maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.author_id !== authContext.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseServer.from('wpx_posts').update(updates).eq('id', postId).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}
