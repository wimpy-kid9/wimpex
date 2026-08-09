import { notFound } from 'next/navigation';

interface Props {
  params: { id: string };
}

export default function PostPage({ params }: Props) {
  const { id } = params;

  if (!id) {
    notFound();
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold">Post {id}</h1>
      <p className="mt-2 text-slate-600">Post detail content goes here.</p>
    </main>
  );
}
