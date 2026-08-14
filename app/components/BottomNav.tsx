"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  const items = [
    { label: 'Home', href: '/feed' },
    { label: 'Stories', href: '/stories' },
    { label: 'Post', href: '/post' },
    { label: 'Chat', href: '/messages' },
    { label: 'Profile', href: '/profile' }
  ];

  const isActive = (href: string) => pathname === href || (href !== '/feed' && pathname?.startsWith(href));
  const activeIndex = items.findIndex((it) => isActive(it.href));

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden">
      <nav className="relative mx-auto flex max-w-3xl items-center justify-between gap-2 border-t border-hairline bg-panel/90 px-3 pt-3 text-sm text-ivory backdrop-blur-xl" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="absolute left-0 right-0 top-0 flex h-full items-center justify-start">
          <div className="mx-auto w-full max-w-3xl relative">
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-9 w-[20%] -translate-y-1/2 transform rounded-lg bg-gold/15 transition-all duration-300"
              style={{ left: `${(activeIndex >= 0 ? activeIndex : 0) * (100 / items.length)}%` }}
            />
          </div>
        </div>

        {items.map((item) => (
          <Link key={item.href} href={item.href} className={`relative z-10 flex w-full flex-col items-center gap-1 rounded-2xl px-3 py-2 transition ${isActive(item.href) ? 'text-ivory' : 'hover:text-ivory'}`}>
            <span className="h-5 w-5">
              {item.label === 'Home' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
              {item.label === 'Stories' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><circle cx="12" cy="8" r="3" strokeWidth="1.5"/><path d="M21 21c-2.5-3-6.5-5-9-5s-6.5 2-9 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
              {item.label === 'Post' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M12 5v14M5 12h14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
              {item.label === 'Chat' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
              {item.label === 'Profile' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" strokeWidth="1.5"/></svg>
              )}
            </span>
            <span className="text-[0.65rem]">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
