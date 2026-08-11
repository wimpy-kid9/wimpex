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
        <p className="mt-2 text-slate-600">Unable to load post.</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <PostDetailClient post={post} />
    </main>
  );
}
