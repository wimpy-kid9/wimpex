import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import PostDetailClient from '@/app/post/PostDetailClient';

interface Props {
  params: { id: string };
}

export default async function PostPage({ params }: Props) {
  const { id } = params;

  if (!id) {
    notFound();
  }

  const { data: post, error } = await supabaseServer.from('wpx_posts').select('*').eq('id', id).maybeSingle();
  if (error || !post) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-semibold">Post</h1>
        <p className="mt-2 text-slate">Unable to load post.</p>
      </main>
    );
  }

  let enrichedPost = post;
  if (post.author_id) {
    const { data: profile } = await supabaseServer
      .from('wpx_profiles')
      .select('display_name, username, avatar_url')
      .eq('user_id', post.author_id)
      .maybeSingle();

    if (profile) {
      enrichedPost = {
        ...post,
        author: profile.display_name || post.author_display_name || 'WIMPEX user',
        handle: profile.username ? `@${profile.username}` : post.author_handle || '@wimpex',
        avatar_url: profile.avatar_url || null
      };
    }
  }

  return (
    <main className="h-[100dvh] w-full overflow-hidden">
      <PostDetailClient post={enrichedPost} />
    </main>
  );
}
