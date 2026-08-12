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

  const body = await request.json().catch(() => ({}));
  const messageId = body.message_id;
  const emoji = body.emoji?.toString().trim();

  if (!messageId || !emoji) {
    return NextResponse.json({ error: 'Message ID and emoji are required.' }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabaseServer
    .from('wpx_messages')
    .select('conversation_id')
    .eq('id', messageId)
    .maybeSingle();

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }
  if (!message) {
    return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabaseServer
    .from('wpx_conversation_members')
    .select('*')
    .eq('conversation_id', message.conversation_id)
    .eq('user_id', authContext.user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of this conversation.' }, { status: 403 });
  }

  const { data: existingReaction, error: existingError } = await supabaseServer
    .from('wpx_message_reactions')
    .select('*')
    .eq('message_id', messageId)
    .eq('user_id', authContext.user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingReaction) {
    if (existingReaction.emoji === emoji) {
      const { error: deleteError } = await supabaseServer
        .from('wpx_message_reactions')
        .delete()
        .eq('id', existingReaction.id);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    } else {
      const { error: updateError } = await supabaseServer
        .from('wpx_message_reactions')
        .update({ emoji })
        .eq('id', existingReaction.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }
  } else {
    const { error: insertError } = await supabaseServer.from('wpx_message_reactions').insert({
      message_id: messageId,
      user_id: authContext.user.id,
      emoji
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { data: reactions, error: reactionsError } = await supabaseServer
    .from('wpx_message_reactions')
    .select('emoji, user_id')
    .eq('message_id', messageId);

  if (reactionsError) {
    return NextResponse.json({ error: reactionsError.message }, { status: 500 });
  }

  const grouped = (reactions || []).reduce((acc: Record<string, { count: number; reactedByMe: boolean }>, reaction: any) => {
    const group = acc[reaction.emoji] ??= { count: 0, reactedByMe: false };
    group.count += 1;
    if (reaction.user_id === authContext.user.id) {
      group.reactedByMe = true;
    }
    return acc;
  }, {});

  return NextResponse.json({ message: { id: messageId, reactions: grouped } });
}
