import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import { isGoldSubscription } from '@/lib/subscription';

async function enrichPostWithAuthor(post: any) {
  if (!post?.author_id) return post;

  const { data: profile, error: profileError } = await supabaseServer
    .from('wpx_profiles')
    .select('display_name, username, avatar_url')
    .eq('user_id', post.author_id)
    .maybeSingle();

  if (profileError) return post;

  const { data: subscription } = await supabaseServer
    .from('wpx_subscriptions')
    .select('user_id, plan, status, metadata, active_until')
    .eq('user_id', post.author_id)
    .eq('status', 'active')
    .order('active_until', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...post,
    author: profile?.display_name || post.author_display_name || 'WIMPEX user',
    handle: profile?.username ? `@${profile.username}` : post.author_handle || '@wimpex',
    avatar_url: profile?.avatar_url || null,
    is_gold: isGoldSubscription(subscription)
  };
}

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

  const post = await enrichPostWithAuthor(data);
  return NextResponse.json({ post });
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
