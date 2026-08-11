import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

async function createNotification(userId: string, actorId: string | null, type: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseServerConfigured) return;
  await supabaseServer.from('wpx_notifications').insert({
    user_id: userId,
    actor_id: actorId,
    type,
    resource_type: 'connection',
    resource_id: resourceId,
    metadata
  });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ connections: [], requests: [] });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseServer.from('wpx_connections').select('*').order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).filter((row: any) => row.requester_id === authContext.user.id || row.recipient_id === authContext.user.id);
  const pendingRequests = rows.filter((row: any) => row.status === 'pending');
  const requesterIds = pendingRequests.map((row: any) => row.requester_id).filter(Boolean);
  const profileMap = new Map<string, any>();

  if (requesterIds.length > 0) {
    const { data: profiles, error: profileError } = await supabaseServer
      .from('wpx_profiles')
      .select('user_id,username,display_name')
      .in('user_id', requesterIds);

    if (!profileError) {
      for (const profile of profiles || []) {
        profileMap.set(profile.user_id, profile);
      }
    }
  }

  const requests = pendingRequests.map((row: any) => {
    const profile = profileMap.get(row.requester_id);
    return {
      ...row,
      requester_display_name: profile?.display_name || row.requester_display_name || null,
      requester_username: profile?.username || row.requester_username || null
    };
  });

  return NextResponse.json({
    connections: rows.filter((row: any) => row.status === 'accepted'),
    requests
  });
}

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

  const body = await request.json();
  const action = body.action || 'send';

  const { data: existingRows, error: existingError } = await supabaseServer.from('wpx_connections').select('*').order('created_at', { ascending: false });
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existing = (existingRows || []).find((row: any) => {
    const samePair = (row.requester_id === authContext.user.id && row.recipient_id === body.recipient_id) || (row.requester_id === body.recipient_id && row.recipient_id === authContext.user.id);
    return samePair && (row.status === 'pending' || row.status === 'accepted');
  });

  if (action === 'send') {
    if (!body.recipient_id || body.recipient_id === authContext.user.id) {
      return NextResponse.json({ error: 'Choose a different recipient.' }, { status: 400 });
    }

    if (existing) {
      return NextResponse.json({ error: 'A connection request already exists.' }, { status: 409 });
    }

    const { data, error } = await supabaseServer.from('wpx_connections').insert({
      requester_id: authContext.user.id,
      recipient_id: body.recipient_id,
      status: 'pending'
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await createNotification(body.recipient_id, authContext.user.id, 'connection_request', data.id, { connection_id: data.id });
    return NextResponse.json({ connection: data });
  }

  if (action === 'accept' || action === 'decline') {
    const connectionId = body.connection_id;
    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connection id.' }, { status: 400 });
    }

    const current = (existingRows || []).find((row: any) => row.id === connectionId);
    if (!current) {
      return NextResponse.json({ error: 'Connection request not found.' }, { status: 404 });
    }

    if (current.recipient_id !== authContext.user.id) {
      return NextResponse.json({ error: 'Only the recipient can act on this request.' }, { status: 403 });
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    const { data, error } = await supabaseServer.from('wpx_connections').update({ status: nextStatus, responded_at: new Date().toISOString() }).eq('id', connectionId).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (action === 'accept') {
      await createNotification(current.requester_id, authContext.user.id, 'connection_accepted', data.id, { connection_id: data.id });
    }

    return NextResponse.json({ connection: data });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
