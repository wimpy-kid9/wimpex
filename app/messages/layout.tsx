'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import MessageList from '@/app/messages/MessageList';

export default function MessagesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isThreadRoute = /^\/messages\/[^/]+$/.test(pathname || '');

  return (
    <main className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <section className={`${isThreadRoute ? 'hidden xl:block' : 'block'} space-y-4 rounded-md border border-hairline bg-panel/80 p-6`}>
        <MessageList />
      </section>
      <section className="rounded-md border border-hairline bg-panel/80 p-6">
        {children}
      </section>
    </main>
  );
}
