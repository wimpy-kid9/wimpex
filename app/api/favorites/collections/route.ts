import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isUserGold } from '@/lib/gold';
import { supabaseServer } from '@/lib/supabase-server';

async function getUser(request: NextRequest) {
  try {
    const authContext = await requireAuth(request);
    if (!(await isUserGold(authContext.user.id))) return null;
    return authContext.user.id;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await getUser(request);
  if (!userId) return NextResponse.json({ error: 'Gold membership is required for named favorite collections.' }, { status: 403 });

  const { data, error } = await supabaseServer
    .from('wpx_favorite_collections')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collections: data || [] });
}

export async function POST(request: NextRequest) {
  const userId = await getUser(request);
  if (!userId) return NextResponse.json({ error: 'Gold membership is required for named favorite collections.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
  if (!name) return NextResponse.json({ error: 'Collection name is required.' }, { status: 400 });

  const { data, error } = await supabaseServer
    .from('wpx_favorite_collections')
    .insert({ user_id: userId, name })
    .select('id, name, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'A collection with that name already exists.' : error.message }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ collection: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const userId = await getUser(request);
  if (!userId) return NextResponse.json({ error: 'Gold membership is required for named favorite collections.' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Collection id is required.' }, { status: 400 });
  const { error } = await supabaseServer.from('wpx_favorite_collections').delete().eq('id', id).eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}