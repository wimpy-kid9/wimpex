"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getUserAccent } from '@/lib/ui-theme';
import { authedFetch } from '@/lib/api-client';
import BottomNav from './BottomNav';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const accent = getUserAccent('wimpex-shell');
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{ top?: number; height?: number }>({});
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const navItems = [
    { label: 'Feed', href: '/feed' },
    { label: 'Calls', href: '/calls' },
    { label: 'Connections', href: '/connections' },
    { label: 'Messages', href: '/messages' },
    { label: 'Post', href: '/post' },
    { label: 'Profile', href: '/profile' }
  ];
  // mobileNavItems was removed in redesign; keep navItems for desktop and mobile BottomNav

  const isActive = (href: string) => pathname === href || (href !== '/feed' && pathname?.startsWith(href));

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await authedFetch('/api/notifications');
        const payload = await response.json();
        setNotifications(payload.notifications || []);
      } catch {
        setNotifications([]);
      }
    };

    void loadNotifications();
  }, []);

  return (
    <div className="min-h-screen text-ivory">
      <div className="hidden md:fixed md:inset-y-0 md:w-64 md:border-r md:border-hairline md:bg-panel/70 md:px-4 md:py-8 md:backdrop-blur-xl">
        <div className="relative space-y-8">
          <div className="thread-line">
            <div className={`mb-3 inline-flex rounded-full bg-gradient-to-r ${accent.gradient} p-[1px]`}>
              <div className="thread-pill rounded-full bg-panel/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-ivory">
                Living accent
              </div>
            </div>
            <h1 className="text-display text-2xl tracking-[0.24em] text-ivory">WIMPEX</h1>
            <p className="mt-2 text-sm text-slate">Social video, connections, and calling.</p>
          </div>
          <div className="rounded-2xl border border-hairline bg-panel-2/70 p-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate">Live signals</p>
            <div className="mt-2 space-y-2">
              {notifications.length > 0 ? notifications.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-hairline bg-ivory/5 px-3 py-2 text-sm text-slate">
                  <p className="font-medium text-ivory">{item.type.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-xs text-slate">{item.metadata?.conversation_id ? 'Message activity' : 'Connection activity'}</p>
                </div>
              )) : <p className="text-sm text-slate">No notifications yet.</p>}
            </div>
          </div>

          <nav className="relative space-y-2">
            {/* animated liquid indicator */}
            <div className="pointer-events-none absolute left-2 top-0 z-0 w-[calc(100%-1rem)] overflow-visible">
              <div
                className="absolute left-0 z-0 w-full rounded-2xl bg-gold/10 backdrop-blur-md transition-all duration-300"
                style={{ top: indicatorStyle.top ?? 0, height: indicatorStyle.height ?? 0 }}
              />
            </div>

            {navItems.map((item, idx) => (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onClick={() => {
                  // compute indicator position on click
                  const el = itemRefs.current[idx];
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    const parentRect = el.parentElement?.getBoundingClientRect();
                    const top = parentRect ? rect.top - parentRect.top : rect.top;
                    setIndicatorStyle({ top: top - 6, height: rect.height + 12 });
                  }
                }}
                className={`relative z-10 thread-card group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition duration-300 hover:-translate-y-0.5 hover:bg-ivory/10 hover:text-ivory ${isActive(item.href) ? 'border-hairline-strong bg-transparent text-ivory' : 'border-hairline bg-white/[0.03] text-ivory'}`}
              >
                <span className="opacity-90">
                  {item.href === '/feed' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {item.href === '/calls' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M22 16.92V21a1 1 0 0 1-1.11 1 19.86 19.86 0 0 1-8.63-3.07A19.38 19.38 0 0 1 3.07 9.74 19.86 19.86 0 0 1 0 1.11 1 1 0 0 1 1 0h4.09a1 1 0 0 1 1 .76c.12.83.33 1.64.63 2.42a1 1 0 0 1-.24 1.03L5.2 6.79a16 16 0 0 0 10.45 10.45l1.58-1.58a1 1 0 0 1 1.03-.24c.78.3 1.59.51 2.42.63a1 1 0 0 1 .76 1V22z" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {item.href === '/connections' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M16 11a4 4 0 1 0-8 0v1" strokeWidth="1.5"/><path d="M12 21v-4" strokeWidth="1.5"/></svg>
                  )}
                  {item.href === '/messages' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {item.href === '/post' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M12 5v14M5 12h14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {item.href === '/profile' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" strokeWidth="1.5"/></svg>
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="md:pl-72">
        <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 lg:px-8 md:pb-8">{children}</div>
      </div>

      {/* Bottom nav redesigned */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
