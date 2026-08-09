import Link from 'next/link';
import type { ReactNode } from 'react';
import { getUserAccent } from '@/lib/ui-theme';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const accent = getUserAccent('wimpex-shell');
  const navItems = [
    { label: 'Feed', href: '/feed' },
    { label: 'Messages', href: '/messages' },
    { label: 'Post', href: '/post' },
    { label: 'Profile', href: '/profile' },
    { label: 'Settings', href: '/settings' }
  ];

  return (
    <div className="min-h-screen text-slate-100">
      <div className="hidden md:fixed md:inset-y-0 md:w-64 md:border-r md:border-white/10 md:bg-slate-950/70 md:px-4 md:py-8 md:backdrop-blur-xl">
        <div className="space-y-8">
          <div className="thread-line">
            <div className={`mb-3 inline-flex rounded-full bg-gradient-to-r ${accent.gradient} p-[1px]`}>
              <div className="thread-pill rounded-full bg-slate-950/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-100">
                Living accent
              </div>
            </div>
            <h1 className="text-display text-2xl tracking-[0.24em] text-slate-100">WIMPEX</h1>
            <p className="mt-2 text-sm text-slate-400">Social video, connections, and calling.</p>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="thread-card block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-200 transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="md:pl-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around border-t border-white/10 bg-slate-950/90 p-3 text-sm text-slate-200 backdrop-blur-xl md:hidden">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl px-3 py-2 transition hover:bg-white/10 hover:text-white">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
