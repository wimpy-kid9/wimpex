import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isGoldSubscription } from '@/lib/subscription';
import { findOrCreateDirectConversation } from '@/lib/conversations';
import { createNotification } from '@/lib/notifications';

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
  const directTitle = typeof conversation.title === 'string' && conversation.title.trim().toLowerCase() !== 'direct message'
    ? conversation.title
    : null;

  return directTitle || profile.display_name || profile.username;
}

function getConversationSummary(conversation: any, members: any[], profiles: any[], messages: any[]) {
  const lastMessage = messages.find((message) => message.conversation_id === conversation.id) ?? null;
  const currentMember = members.find((member) => member.user_id === conversation.currentUserId);
  const otherMemberIds = members.map((member) => member.user_id).filter((id: string) => id !== conversation.currentUserId);
  const otherProfiles = profiles.filter((profile: any) => otherMemberIds.includes(profile.user_id));
  const otherUser = otherProfiles[0] || null;

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
    otherUser,
    currentUserId: conversation.currentUserId,
    pinnedAt: currentMember?.pinned_at || null,
    folderName: currentMember?.folder_name || null,
    wallpaperUrl: currentMember?.wallpaper_url || null,
    wallpaperColor: currentMember?.wallpaper_color || null
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

async function ensureAcceptedConnection(authUserId: string, recipientId: string) {
  if (authUserId === recipientId) {
    return false;
  }

  const { data: connectionRows, error: connectionError } = await supabaseServer
    .from('wpx_connections')
    .select('requester_id, recipient_id, status')
    .or(`and(requester_id.eq.${authUserId},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${authUserId})`);

  if (connectionError) {
    throw new Error(connectionError.message);
  }

  return (connectionRows || []).some((row: any) => row.status === 'accepted');
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
  const before = request.nextUrl.searchParams.get('before');
  const participantId = request.nextUrl.searchParams.get('participant_id');

  if (conversationId) {
    const { data: conversation, error: conversationError } = await supabaseServer.from('wpx_conversations').select('*').eq('id', conversationId).maybeSingle();
    if (conversationError) {
      return NextResponse.json({ error: conversationError.message }, { status: 500 });
    }
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    let messagesQuery = supabaseServer.from('wpx_messages').select('*').eq('conversation_id', conversationId);
    if (before) messagesQuery = messagesQuery.lt('created_at', before);
    const [{ data: recentMessages, error: messagesError }, { data: members, error: membersError }] = await Promise.all([
      messagesQuery.order('created_at', { ascending: false }).limit(50),
      supabaseServer.from('wpx_conversation_members').select('*').eq('conversation_id', conversationId)
    ]);

    const messages = (recentMessages || []).reverse();

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }
    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    const otherUserIds = Array.from(
      new Set(
        (members || []).map((row: any) => row.user_id).filter((id: string) => id !== authContext.user.id)
      )
    );

    const replyToIds = Array.from(
      new Set(
        (messages || [])
          .map((message: any) => message.reply_to_message_id)
          .filter((id: string | null): id is string => Boolean(id))
      )
    );

    const sharedPostIds = Array.from(
      new Set(
        (messages || [])
          .map((message: any) => message.shared_post_id)
          .filter((id: string | null): id is string => Boolean(id))
      )
    );

    // None of these five queries depend on each other — only on `messages`
    // or `members`, both already in hand — so they run as one parallel
    // round trip instead of five sequential ones. That's the main reason
    // opening a chat used to feel slow: each `await` here was a full
    // network round trip to the database, one after another.
    const [
      { data: replyMessages, error: replyMessagesError },
      { data: sharedPosts, error: sharedPostsError },
      { data: reactions, error: reactionsError },
      { data: profiles, error: profileError },
      { data: subscriptions }
    ] = await Promise.all([
      replyToIds.length
        ? supabaseServer.from('wpx_messages').select('id, body, sender_id').in('id', replyToIds)
        : Promise.resolve({ data: [], error: null }),
      sharedPostIds.length
        ? supabaseServer.from('wpx_posts').select('id, caption, video_url, image_url, thumbnail_url, author_id').in('id', sharedPostIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseServer.from('wpx_message_reactions').select('message_id, emoji, user_id').in('message_id', (messages || []).map((message: any) => message.id)),
      supabaseServer.from('wpx_profiles').select('user_id, username, display_name, avatar_url').in('user_id', otherUserIds),
      otherUserIds.length > 0
        ? supabaseServer
          .from('subscriptions')
          .select('user_id, status, current_period_end, plan_id, plans!plan_id(id, product_name, name, price, billing_interval)')
          .in('user_id', otherUserIds)
          .eq('status', 'active')
          .order('current_period_end', { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ]);

    if (replyMessagesError) {
      return NextResponse.json({ error: replyMessagesError.message }, { status: 500 });
    }
    if (sharedPostsError) {
      return NextResponse.json({ error: sharedPostsError.message }, { status: 500 });
    }
    if (reactionsError) {
      return NextResponse.json({ error: reactionsError.message }, { status: 500 });
    }
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const replyMessageMap = new Map((replyMessages || []).map((reply: any) => [reply.id, reply]));

    // sharedAuthors genuinely depends on sharedPosts' result (we don't know
    // the author ids until sharedPosts comes back), so it's the one query
    // that has to stay sequential — but it's a no-op in the common case
    // where a chat has no shared posts at all.
    const sharedAuthorIds = Array.from(new Set((sharedPosts || []).map((post: any) => post.author_id).filter(Boolean)));
    const { data: sharedAuthors } = sharedAuthorIds.length
      ? await supabaseServer
        .from('wpx_profiles')
        .select('user_id, username, display_name')
        .in('user_id', sharedAuthorIds)
      : { data: [] };
    const sharedPostMap = new Map((sharedPosts || []).map((post: any) => [
      post.id,
      {
        ...post,
        author: (sharedAuthors || []).find((author: any) => author.user_id === post.author_id) || null
      }
    ]));

    const reactionGroups = (reactions || []).reduce(
      (acc: Record<string, Record<string, { count: number; reactedByMe: boolean }>>, reaction: any) => {
        const messageReactions = acc[reaction.message_id] ??= {};
        const group = messageReactions[reaction.emoji] ??= { count: 0, reactedByMe: false };
        group.count += 1;
        if (reaction.user_id === authContext.user.id) {
          group.reactedByMe = true;
        }
        return acc;
      },
      {} as Record<string, Record<string, { count: number; reactedByMe: boolean }>>
    );

    const messagesWithReactions = (messages || []).map((message: any) => ({
      ...message,
      replyPreview: message.reply_to_message_id ? replyMessageMap.get(message.reply_to_message_id) ?? null : null,
      sharedPost: message.shared_post_id ? sharedPostMap.get(message.shared_post_id) ?? null : null,
      reactions: reactionGroups[message.id] || {}
    }));

    const profilesWithGold = profiles || [];
    if (otherUserIds.length > 0) {
      const subscriptionMap: Record<string, any> = {};
      (subscriptions || []).forEach((subscription: any) => {
        if (subscription.user_id && !subscriptionMap[subscription.user_id]) {
          subscriptionMap[subscription.user_id] = subscription;
        }
      });

      profilesWithGold.forEach((profile: any) => {
        profile.is_gold = isGoldSubscription(subscriptionMap[profile.user_id]);
      });
    }

    const summary = getConversationSummary(
      { ...conversation, currentUserId: authContext.user.id },
      members || [],
      profilesWithGold,
      messages || []
    );

    return NextResponse.json({ messages: messagesWithReactions, conversation: summary, hasMore: (recentMessages || []).length === 50 });
  }

  if (participantId) {
    if (participantId === authContext.user.id) {
      return NextResponse.json({ error: 'Cannot open a chat with yourself.' }, { status: 400 });
    }

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
    if (existingConversationId) {
      return NextResponse.json({ conversation: { id: existingConversationId } });
    }

    let conversation;
    try {
      const isAcceptedConnection = await ensureAcceptedConnection(authContext.user.id, participantId);
      if (!isAcceptedConnection) {
        return NextResponse.json({ error: 'You must be an accepted connection to start a chat.' }, { status: 403 });
      }
      conversation = await findOrCreateDirectConversation(authContext.user.id, participantId);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }

    return NextResponse.json({ conversation: { id: conversation.id } });
  }

  const { data: memberships, error: membershipError } = await supabaseServer.from('wpx_conversation_members').select('conversation_id').eq('user_id', authContext.user.id);
  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const conversationIds = (memberships || []).map((row: any) => row.conversation_id);
  if (conversationIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  // These three queries only depend on conversationIds, not on each other —
  // they were previously run one after another (conversations, then members,
  // then a fully separate messages query later), turning every chat-list
  // load into a chain of round trips to the database. Running them together
  // cuts that wait roughly in a third.
  //
  // The messages query also used to fetch every message in every one of the
  // user's conversations with no limit at all, just to find each
  // conversation's single latest message for the preview line — meaning the
  // chat list got slower forever as message history grew. It's ordered
  // newest-first and capped instead; that's enough rows to find each
  // conversation's latest message in all but extreme edge cases, without
  // scanning the whole table on every page load.
  const messagesCap = Math.min(Math.max(conversationIds.length * 5, 100), 1000);
  const [
    { data: conversations, error: conversationError },
    { data: members, error: membersError },
    { data: messages, error: messagesError }
  ] = await Promise.all([
    supabaseServer.from('wpx_conversations').select('*').in('id', conversationIds).order('last_activity_at', { ascending: false }),
    supabaseServer.from('wpx_conversation_members').select('*').in('conversation_id', conversationIds),
    supabaseServer
      .from('wpx_messages')
      .select('conversation_id, sender_id, body, media_type, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(messagesCap)
  ]);

  if (conversationError) {
    return NextResponse.json({ error: conversationError.message }, { status: 500 });
  }
  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }
  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const otherUserIds = Array.from(
    new Set(
      (members || []).map((row: any) => row.user_id).filter((id: string) => id !== authContext.user.id)
    )
  );

  // Profiles and subscriptions both only depend on otherUserIds, so they can
  // also run together instead of one after the other.
  const [
    { data: profiles, error: profileError },
    { data: subscriptions }
  ] = await Promise.all([
    supabaseServer
      .from('wpx_profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', otherUserIds),
    otherUserIds.length > 0
      ? supabaseServer
          .from('subscriptions')
          .select('user_id, status, current_period_end, plan_id, plans!plan_id(id, product_name, name, price, billing_interval)')
          .in('user_id', otherUserIds)
          .eq('status', 'active')
          .order('current_period_end', { ascending: false })
      : Promise.resolve({ data: null, error: null })
  ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const profilesWithGold = profiles || [];
  if (otherUserIds.length > 0) {
    const subscriptionMap: Record<string, any> = {};
    (subscriptions || []).forEach((subscription: any) => {
      if (subscription.user_id && !subscriptionMap[subscription.user_id]) {
        subscriptionMap[subscription.user_id] = subscription;
      }
    });

    profilesWithGold.forEach((profile: any) => {
      profile.is_gold = isGoldSubscription(subscriptionMap[profile.user_id]);
    });
  }

  const summaries = (conversations || []).map((conversation: any) =>
    getConversationSummary(
      { ...conversation, currentUserId: authContext.user.id },
      (members || []).filter((row: any) => row.conversation_id === conversation.id),
      profilesWithGold,
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
      let isAcceptedConnection = false;
      try {
        isAcceptedConnection = await ensureAcceptedConnection(authContext.user.id, recipientId);
      } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
      }
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
    reply_to_message_id: body.reply_to_message_id || null
  }).select().single();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  await supabaseServer.from('wpx_conversations').update({ last_activity_at: new Date().toISOString() }).eq('id', conversationData.id);

  let notifyIds: string[];
  if (conversationId) {
    const { data: conversationMembers, error: conversationMembersError } = await supabaseServer
      .from('wpx_conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId);
    if (conversationMembersError) {
      return NextResponse.json({ error: conversationMembersError.message }, { status: 500 });
    }
    notifyIds = (conversationMembers || []).map((member: any) => member.user_id);
  } else {
    notifyIds = recipients.length > 0 ? recipients : [body.recipient_id];
  }
  const { data: senderProfile } = await supabaseServer
    .from('wpx_profiles')
    .select('username, display_name')
    .eq('user_id', authContext.user.id)
    .maybeSingle();
  const senderName = senderProfile?.display_name || senderProfile?.username || 'Someone';
  for (const recipientId of notifyIds.filter((id: string) => id && id !== authContext.user.id)) {
    const { data: recipientProfile } = await supabaseServer.from('wpx_profiles').select('notification_sound').eq('user_id', recipientId).maybeSingle();
    await createNotification({
      userId: recipientId,
      actorId: authContext.user.id,
      type: 'message',
      resourceType: 'message',
      resourceId: messageData.id,
      metadata: { conversation_id: conversationData.id },
      push: {
        title: senderName,
        body: textBody || 'You received a new message.',
        url: `/messages?conversation_id=${conversationData.id}`,
        tag: `message-${conversationData.id}`,
        channelId: 'wimpex-messages',
        data: { type: 'message', conversationId: conversationData.id, senderId: authContext.user.id, notificationSound: recipientProfile?.notification_sound || 'default' }
      }
    });
  }

  return NextResponse.json({ conversation: conversationData, message: messageData });
}
