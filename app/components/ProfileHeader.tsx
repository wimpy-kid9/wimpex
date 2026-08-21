"use client";

import Link from 'next/link';
import FollowButton from './FollowButton';
import GoldBadge from './GoldBadge';
import { useEffect, useRef, useState } from 'react';
import type { SVGProps, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { authedFetch } from '@/lib/api-client';
import { isGoldSubscription } from '@/lib/subscription';

/* ---------------------------------------------------------------------- */
/*  Small inline icon set (no extra deps) — all inherit currentColor       */
/* ---------------------------------------------------------------------- */

function IconUserPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M18.5 8.5v5M16 11h5" />
    </svg>
  );
}

function IconMore(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function IconCrown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z" />
    </svg>
  );
}


function IconPencil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20l4.4-1 10-10-3.4-3.4-10 10L4 20z" />
      <path d="M13.5 6.5L17.5 10.5" />
    </svg>
  );
}

function IconShare(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="19" r="2.4" />
      <path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" />
    </svg>
  );
}

function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function IconBlock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.5 6.5l11 11" />
    </svg>
  );
}

function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconButton({
  children,
  label,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full bg-ivory/5 text-ivory transition hover:bg-ivory/10 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function IconLink({
  children,
  label,
  className = '',
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { label: string }) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full bg-ivory/5 text-ivory transition hover:bg-ivory/10 ${className}`}
      {...(rest as any)}
    >
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------------- */

export default function ProfileHeader({ profile, subscription }: { profile: any; subscription?: any | null }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await authedFetch('/api/profile');
        if (!resp.ok) return;
        const p = await resp.json();
        setCurrentUserId(p.profile?.user_id ?? null);
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadSummary = async () => {
      if (!profile?.user_id) return;
      try {
        const resp = await authedFetch(`/api/follow?user_id=${encodeURIComponent(profile.user_id)}&summary=true`);
        if (!resp.ok) return;
        const j = await resp.json();
        setSummary(j);
      } catch {
        // ignore
      }
    };
    void loadSummary();
  }, [profile?.user_id]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const isOwn = profile?.user_id && currentUserId && profile.user_id === currentUserId;
  const isGold = isGoldSubscription(subscription);

  const shareProfile = async () => {
    try {
      const url = `${window.location.origin}/user/${profile?.user_id ?? ''}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const blockUser = async () => {
    if (!profile?.user_id || blocked) return;
    setBlocking(true);
    try {
      const response = await authedFetch('/api/blocks', {
        method: 'POST',
        body: JSON.stringify({ blocked_user_id: profile.user_id })
      });
      if (response.ok) setBlocked(true);
    } catch {
      // ignore
    } finally {
      setBlocking(false);
      setMenuOpen(false);
    }
  };

  return (
    <section className="surface-veil rounded-md bg-panel-2/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl gold-reveal">
      {profile?.banner_url ? (
        <div className="mb-5 h-32 overflow-hidden rounded-2xl">
          <img src={profile.banner_url} alt="Profile banner" className="h-full w-full object-cover" />
        </div>
      ) : null}

      {/* Top icon bar */}
      <div className="mb-4 flex items-center justify-between">
        {isOwn ? (
          <IconLink href="/explore" label="Find people">
            <IconUserPlus className="h-5 w-5" />
          </IconLink>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {isGold ? (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/15 text-gold">
              <IconCrown className="h-5 w-5" />
            </span>
          ) : isOwn ? (
            <IconLink href="/settings" label="Upgrade to Gold" className="text-gold">
              <IconCrown className="h-5 w-5" />
            </IconLink>
          ) : null}

          <div className="relative" ref={menuRef}>
            <IconButton label="More options" onClick={() => setMenuOpen((v) => !v)}>
              <IconMore className="h-5 w-5" />
            </IconButton>

            {menuOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-2xl border border-hairline bg-panel shadow-2xl shadow-black/40">
                {isOwn ? (
                  <>
                    <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-sm text-ivory hover:bg-ivory/5">
                      <IconPencil className="h-4 w-4" /> Edit profile
                    </Link>
                    <Link href="/calls" className="flex items-center gap-3 px-4 py-3 text-sm text-ivory hover:bg-ivory/5">
                      <IconClock className="h-4 w-4" /> Call history
                    </Link>
                    <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-sm text-ivory hover:bg-ivory/5">
                      <IconMore className="h-4 w-4 rotate-90" /> Settings
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={blockUser}
                    disabled={blocked || blocking}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-rose-300 hover:bg-ivory/5 disabled:opacity-60"
                  >
                    <IconBlock className="h-4 w-4" /> {blocked ? 'Blocked' : 'Block user'}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Avatar + identity */}
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || profile.username || 'Profile avatar'}
              className={`h-24 w-24 rounded-full object-cover ring-2 ${isGold ? 'ring-gold/70 ring-offset-2 ring-offset-panel-2' : 'ring-white/10'}`}
            />
          ) : (
            <div className={`grid h-24 w-24 place-items-center rounded-full bg-panel-2 text-3xl font-semibold text-slate ring-2 ${isGold ? 'ring-gold/70 ring-offset-2 ring-offset-panel-2' : 'ring-white/10'}`}>
              {profile?.display_name?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || 'P'}
            </div>
          )}
          {isOwn ? (
            <Link
              href="/settings"
              aria-label="Change profile photo"
              title="Change profile photo"
              className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-gold text-obsidian ring-2 ring-panel-2 transition hover:bg-gold-deep"
            >
              <IconPlus className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-display text-2xl text-ivory">{profile?.display_name ?? 'Profile'}</h1>
          {isGold ? <GoldBadge size="md" inline /> : null}
        </div>
        {profile?.username ? <p className="text-sm text-slate">@{profile.username}</p> : null}

        {/* Action row */}
        <div className="mt-4 flex items-center gap-2">
          {isOwn ? (
            <>
              <Link href="/settings" className="rounded-2xl border border-hairline px-6 py-2 text-sm font-semibold text-ivory transition hover:bg-ivory/10">
                Edit profile
              </Link>
              <IconButton label={copied ? 'Link copied' : 'Share profile'} onClick={shareProfile}>
                <IconShare className="h-4 w-4" />
              </IconButton>
            </>
          ) : profile?.user_id ? (
            <FollowButton userId={profile.user_id} />
          ) : null}
        </div>

        {/* Stats */}
        {summary ? (
          <div className="mt-5 flex items-center gap-6">
            <div className="text-center">
              <p className="text-xl font-semibold text-ivory">{summary.followingCount ?? 0}</p>
              <p className="text-xs text-slate">Following</p>
            </div>
            <div className="h-8 w-px bg-hairline" />
            <div className="text-center">
              <p className="text-xl font-semibold text-ivory">{summary.followerCount ?? 0}</p>
              <p className="text-xs text-slate">Followers</p>
            </div>
            <div className="h-8 w-px bg-hairline" />
            <div className="text-center">
              <p className="text-xl font-semibold text-ivory">{summary.totalLikeCount ?? 0}</p>
              <p className="text-xs text-slate">Likes</p>
            </div>
          </div>
        ) : null}

        {/* Bio */}
        <div className="mt-4 max-w-md">
          {profile?.bio ? (
            <p className="text-sm text-slate">{profile.bio}</p>
          ) : isOwn ? (
            <Link href="/settings" className="inline-flex items-center gap-1 rounded-full border border-hairline px-4 py-1.5 text-sm text-slate transition hover:bg-ivory/10">
              <IconPlus className="h-3.5 w-3.5" /> Add bio
            </Link>
          ) : null}
        </div>

        {Array.isArray(profile?.custom_links) && profile.custom_links.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {profile.custom_links.map((link: any) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/10">
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
