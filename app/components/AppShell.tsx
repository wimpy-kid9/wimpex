'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getUserAccent } from '@/lib/ui-theme';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const accent = getUserAccent('wimpex-shell');
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<any[]>([]);
  const navItems = [
    { label: 'Feed', href: '/feed' },
    { label: 'Calls', href: '/calls' },
    { label: 'Connections', href: '/connections' },
    { label: 'Messages', href: '/messages' },
    { label: 'Post', href: '/post' },
    { label: 'Profile', href: '/profile' }
  ];
  const mobileNavItems = navItems.filter((item) => item.href !== '/messages');

  const isActive = (href: string) => pathname === href || (href !== '/feed' && pathname?.startsWith(href));

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/notifications');
        const payload = await response.json();
        setNotifications(payload.notifications || []);
      } catch {
        setNotifications([]);
      }
    };

    void loadNotifications();
  }, []);

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
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-400">Live signals</p>
            <div className="mt-2 space-y-2">
              {notifications.length > 0 ? notifications.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                  <p className="font-medium text-white">{item.type.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.metadata?.conversation_id ? 'Message activity' : 'Connection activity'}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No notifications yet.</p>}
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`thread-card block rounded-2xl border px-4 py-3 text-sm font-medium transition duration-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white ${isActive(item.href) ? 'border-amber-400/40 bg-amber-400/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-200'}`}
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
        {mobileNavItems.map((item) => (
          <Link key={item.href} href={item.href} className={`rounded-2xl px-3 py-2 transition ${isActive(item.href) ? 'bg-amber-400/15 text-white' : 'hover:bg-white/10 hover:text-white'}`}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
