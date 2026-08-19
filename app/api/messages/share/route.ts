import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const userId = authContext.user.id;

    const { postId, recipientId } = await request.json();

    if (!postId || !recipientId) {
      return NextResponse.json(
        { error: 'Missing postId or recipientId' },
        { status: 400 }
      );
    }

    const { data: senderMemberships, error: senderMembershipError } = await supabaseServer
      .from('wpx_conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);
    const { data: recipientMemberships, error: recipientMembershipError } = await supabaseServer
      .from('wpx_conversation_members')
      .select('conversation_id')
      .eq('user_id', recipientId);
    if (senderMembershipError || recipientMembershipError) {
      return NextResponse.json({ error: 'Failed to find conversation' }, { status: 500 });
    }

    const recipientConversationIds = new Set((recipientMemberships || []).map((row: any) => row.conversation_id));
    const existingConversationId = (senderMemberships || [])
      .map((row: any) => row.conversation_id)
      .find((id: string) => recipientConversationIds.has(id));
    let conversation = existingConversationId ? { id: existingConversationId } : null;

    if (!conversation) {
      const { data: newConv, error: createError } = await supabaseServer
        .from('wpx_conversations')
        .insert({ type: 'direct', title: 'Direct message' })
        .select()
        .single();

      if (createError || !newConv) {
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        );
      }
      const { error: memberError } = await supabaseServer.from('wpx_conversation_members').insert([
        { conversation_id: newConv.id, user_id: userId },
        { conversation_id: newConv.id, user_id: recipientId }
      ]);
      if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
      conversation = newConv;
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Failed to resolve conversation' }, { status: 500 });
    }

    // Get the post to include in message
    const { data: post } = await supabaseServer
      .from('wpx_posts')
      .select('id, caption, video_url, image_url')
      .eq('id', postId)
      .single();

    // Create "shared post" message
    const { data: message, error: messageError } = await supabaseServer
      .from('wpx_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: userId,
        body: `Shared a video: ${post?.caption || 'Check this out!'}`,
        shared_post_id: postId
      })
      .select()
      .single();

    if (messageError) {
      return NextResponse.json(
        { error: messageError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error('Share message error:', err);
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
