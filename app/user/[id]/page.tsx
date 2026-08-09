import { notFound } from 'next/navigation';

interface Props {
  params: { id: string };
}

export default function UserPage({ params }: Props) {
  const { id } = params;

  if (!id) {
    notFound();
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold">User {id}</h1>
      <p className="mt-2 text-slate-600">User profile content goes here.</p>
    </main>
  );
}
