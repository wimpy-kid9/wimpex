import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

const CHAT_BUCKET = 'wpx-chat-media';
const CHAT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg'
];

async function createNotification(userId: string, actorId: string | null, type: string, resourceId: string | null, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseServerConfigured) return;
  await supabaseServer.from('wpx_notifications').insert({
    user_id: userId,
    actor_id: actorId,
    type,
    resource_type: 'message',
    resource_id: resourceId,
    metadata
  });
}

function getConversationTitle(conversation: any, members: any[], profiles: any[], currentUserId: string) {
  const otherMemberIds = members.map((member) => member.user_id).filter((id: string) => id !== currentUserId);
  const otherProfiles = profiles.filter((profile: any) => otherMemberIds.includes(profile.user_id));
  if (conversation.type === 'group') {
    return conversation.title || otherProfiles.map((user: any) => user.display_name || user.username).join(', ');
  }

  const profile = otherProfiles[0] || {
    display_name: 'Unknown',
    username: 'unknown'
  };
  return conversation.title || profile.display_name || profile.username;
}

function getConversationSummary(conversation: any, members: any[], profiles: any[], messages: any[]) {
  const lastMessage = messages.find((message) => message.conversation_id === conversation.id) ?? null;
  const otherMemberIds = members.map((member) => member.user_id).filter((id: string) => id !== conversation.currentUserId);
  const otherProfiles = profiles.filter((profile: any) => otherMemberIds.includes(profile.user_id));

  return {
    id: conversation.id,
    title: getConversationTitle(conversation, members, profiles, conversation.currentUserId),
    participantCount: otherProfiles.length,
    lastActivityAt: conversation.last_activity_at,
    preview: lastMessage ? lastMessage.body || `${lastMessage.media_type || 'Message'} sent` : 'No messages yet',
    previewSentByMe: lastMessage?.sender_id === conversation.currentUserId,
    previewAt: lastMessage?.created_at ?? conversation.last_activity_at,
    isGroup: conversation.type === 'group',
    otherUsers: otherProfiles,
    currentUserId: conversation.currentUserId
  };
}

async function uploadChatMedia(mediaFile: File, userId: string) {
  const fileType = mediaFile.type;
  if (!CHAT_MIME_TYPES.includes(fileType)) {
    throw new Error('Unsupported chat attachment format.');
  }

  try {
    await supabaseServer.storage.createBucket(CHAT_BUCKET, {
      public: true,
      allowedMimeTypes: CHAT_MIME_TYPES,
      fileSizeLimit: '104857600'
    });
  } catch {
    // Ignore if bucket already exists or not permitted.
  }

  const fileName = `${Date.now()}-${mediaFile.name.replace(/\s+/g, '-')}`;
  const { data: uploadData, error: uploadError } = await supabaseServer.storage
    .from(CHAT_BUCKET)
    .upload(`attachments/${userId}/${fileName}`, mediaFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: mediaFile.type || 'application/octet-stream'
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabaseServer.storage.from(CHAT_BUCKET).getPublicUrl(uploadData?.path || fileName);
  return {
    mediaUrl: publicUrlData?.publicUrl || '',
    mediaType: fileType.startsWith('image/')
      ? 'image'
      : fileType.startsWith('video/')
      ? 'video'
      : fileType.startsWith('audio/')
      ? 'voice_note'
      : 'text'
  };
}

async function findOrCreateDirectConversation(authUserId: string, recipientId: string) {
  const { data: existingMemberships, error: membershipError } = await supabaseServer
    .from('wpx_conversation_members')
    .select('conversation_id, user_id')
    .in('user_id', [authUserId, recipientId]);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const counts = (existingMemberships || []).reduce((acc: Record<string, number>, row: any) => {
    acc[row.conversation_id] = (acc[row.conversation_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const existingConversationId = Object.keys(counts).find((conversationId) => counts[conversationId] === 2);
  if (existingConversationId) {
    const { data, error } = await supabaseServer.from('wpx_conversations').select('*').eq('id', existingConversationId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data: dataConversation, error: conversationError } = await supabaseServer
    .from('wpx_conversations')
    .insert({ type: 'direct', title: 'Direct message' })
    .select()
    .single();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  const { error: membersError } = await supabaseServer.from('wpx_conversation_members').insert([
    { conversation_id: dataConversation.id, user_id: authUserId },
    { conversation_id: dataConversation.id, user_id: recipientId }
  ]);
  if (membersError) {
    throw new Error(membersError.message);
  }

  return dataConversation;
}

async function createGroupConversation(authUserId: string, recipientIds: string[], title: string) {
  const { data: dataConversation, error: conversationError } = await supabaseServer
    .from('wpx_conversations')
    .insert({ type: 'group', title: title || 'Group chat' })
    .select()
    .single();

  if (conversationError) {
    throw new Error(conversationError.message);
  }

  const membersToInsert = [
    { conversation_id: dataConversation.id, user_id: authUserId },
    ...recipientIds.map((recipientId) => ({ conversation_id: dataConversation.id, user_id: recipientId }))
  ];

  const { error: membersError } = await supabaseServer.from('wpx_conversation_members').insert(membersToInsert);
  if (membersError) {
    throw new Error(membersError.message);
  }

  return dataConversation;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ conversations: [] });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get('conversation_id');
  const participantId = request.nextUrl.searchParams.get('participant_id');

  if (conversationId) {
    const { data, error } = await supabaseServer.from('wpx_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ messages: data || [] });
  }

  if (participantId) {
    const { data: membershipRows, error: membershipError } = await supabaseServer
      .from('wpx_conversation_members')
      .select('conversation_id, user_id')
      .in('user_id', [authContext.user.id, participantId]);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    const conversationCounts = (membershipRows || []).reduce((acc: Record<string, number>, row: any) => {
      acc[row.conversation_id] = (acc[row.conversation_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const existingConversationId = Object.keys(conversationCounts).find((conversationId) => conversationCounts[conversationId] === 2);
    return NextResponse.json({ conversation: existingConversationId ? { id: existingConversationId } : null });
  }

  const { data: memberships, error: membershipError } = await supabaseServer.from('wpx_conversation_members').select('conversation_id').eq('user_id', authContext.user.id);
  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const conversationIds = (memberships || []).map((row: any) => row.conversation_id);
  if (conversationIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const { data: conversations, error: conversationError } = await supabaseServer.from('wpx_conversations').select('*').in('id', conversationIds).order('last_activity_at', { ascending: false });
  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }

  const { data: members, error: membersError } = await supabaseServer
    .from('wpx_conversation_members')
    .select('conversation_id, user_id')
    .in('conversation_id', conversationIds);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const otherUserIds = Array.from(
    new Set(
      (members || []).map((row: any) => row.user_id).filter((id: string) => id !== authContext.user.id)
    )
  );

  const { data: profiles, error: profileError } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', otherUserIds);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: messages, error: messagesError } = await supabaseServer
    .from('wpx_messages')
    .select('conversation_id, sender_id, body, media_type, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const summaries = (conversations || []).map((conversation: any) =>
    getConversationSummary(
      { ...conversation, currentUserId: authContext.user.id },
      (members || []).filter((row: any) => row.conversation_id === conversation.id),
      profiles || [],
      messages || []
    )
  );

  return NextResponse.json({ conversations: summaries });
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

  let body: any = {};
  let mediaUrl = '';
  let mediaType = 'text';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    body = {
      ...Object.fromEntries(formData.entries()),
      body: formData.get('body')?.toString() || '',
      title: formData.get('title')?.toString() || ''
    };

    const mediaFile = formData.get('media');
    if (mediaFile && typeof mediaFile !== 'string' && 'arrayBuffer' in mediaFile) {
      const upload = await uploadChatMedia(mediaFile as File, authContext.user.id);
      mediaUrl = upload.mediaUrl;
      mediaType = upload.mediaType;
    }
  } else {
    body = await request.json().catch(() => ({}));
  }

  const recipientIds = Array.isArray(body.recipient_ids)
    ? body.recipient_ids.filter(Boolean)
    : body.recipient_ids
    ? [body.recipient_ids]
    : body.recipient_id
    ? [body.recipient_id]
    : [];

  const title = body.title || '';
  const conversationId = body.conversation_id;
  const textBody = body.body?.trim() || '';

  if (!conversationId && recipientIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one recipient or an existing conversation.' }, { status: 400 });
  }

  if (!textBody && !mediaUrl) {
    return NextResponse.json({ error: 'Message text or attachment is required.' }, { status: 400 });
  }

  const recipients = Array.from(new Set(recipientIds)).filter((recipientId): recipientId is string => typeof recipientId === 'string');
  if (recipients.length > 0) {
      for (const recipientId of recipients) {
      if (recipientId === authContext.user.id) continue;
      // Fetch any connection rows between the two users and validate accepted status
      const { data: connectionRows, error: connectionError } = await supabaseServer
        .from('wpx_connections')
        .select('*')
        .or(`requester_id.eq.${authContext.user.id},recipient_id.eq.${authContext.user.id},requester_id.eq.${recipientId},recipient_id.eq.${recipientId}`);
      if (connectionError) {
        return NextResponse.json({ error: connectionError.message }, { status: 500 });
      }
      const pairMatch = (connectionRows || []).some((row: any) => {
        return (
          (row.requester_id === authContext.user.id && row.recipient_id === recipientId) ||
          (row.requester_id === recipientId && row.recipient_id === authContext.user.id)
        );
      });
      const isAcceptedConnection = (connectionRows || []).some((row: any) => pairMatch && row.status === 'accepted');
      if (!isAcceptedConnection) {
        return NextResponse.json({ error: 'All recipients must be accepted connections.' }, { status: 403 });
      }
    }
  }

  let conversationData: any = null;

  if (conversationId) {
    const { data: membershipRows, error: membershipError } = await supabaseServer
      .from('wpx_conversation_members')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', authContext.user.id);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    if (!membershipRows || membershipRows.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this conversation.' }, { status: 403 });
    }

    const { data, error } = await supabaseServer.from('wpx_conversations').select('*').eq('id', conversationId).maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    conversationData = data;
  } else if (recipients.length === 1) {
    try {
      conversationData = await findOrCreateDirectConversation(authContext.user.id, recipients[0]);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  } else if (recipients.length > 1) {
    try {
      conversationData = await createGroupConversation(authContext.user.id, recipients as string[], title || `Group chat with ${recipients.length} people`);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }

  const { data: messageData, error: messageError } = await supabaseServer.from('wpx_messages').insert({
    conversation_id: conversationData.id,
    sender_id: authContext.user.id,
    body: textBody,
    media_type: mediaUrl ? mediaType : 'text',
    media_url: mediaUrl || null,
    status: 'sent'
  }).select().single();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  await supabaseServer.from('wpx_conversations').update({ last_activity_at: new Date().toISOString() }).eq('id', conversationData.id);

  const notifyIds = recipients.length > 0 ? recipients : [body.recipient_id];
  for (const recipientId of notifyIds.filter((id: string) => id && id !== authContext.user.id)) {
    await createNotification(recipientId, authContext.user.id, 'message', conversationData.id, { conversation_id: conversationData.id });
  }

  return NextResponse.json({ conversation: conversationData, message: messageData });
}
