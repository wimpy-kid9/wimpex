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

    // Get or create conversation between sender and recipient
    let { data: conversation, error: convError } = await supabaseServer
      .from('wpx_conversations')
      .select('id, participant_ids')
      .contains('participant_ids', [userId, recipientId])
      .single();

    if (convError || !conversation) {
      // Create new conversation
      const participantIds = [userId, recipientId].sort();
      const { data: newConv, error: createError } = await supabaseServer
        .from('wpx_conversations')
        .insert({
          participant_ids: participantIds
        })
        .select()
        .single();

      if (createError || !newConv) {
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        );
      }
      conversation = newConv;
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
