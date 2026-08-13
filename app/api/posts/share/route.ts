import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);

    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    // Verify the post exists
    const { data: post, error: postError } = await supabaseServer
      .from('wpx_posts')
      .select('id, share_count')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Increment share count
    const { data: updatedPost, error: updateError } = await supabaseServer
      .from('wpx_posts')
      .update({ share_count: (post.share_count || 0) + 1 })
      .eq('id', postId)
      .select()
      .single();

    if (updateError) {
      console.error('Share count update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ post: updatedPost }, { status: 200 });
  } catch (err) {
    console.error('Post share error:', err);
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
