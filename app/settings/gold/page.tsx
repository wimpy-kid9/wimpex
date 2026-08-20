'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { applyTheme, type ThemeName } from '@/lib/theme';
import { isGoldSubscription } from '@/lib/subscription';

const themes: Array<{ value: ThemeName; label: string; color: string }> = [
  { value: 'gold', label: 'Gold', color: '#c9a961' },
  { value: 'blue', label: 'Blue', color: '#4f8ff7' },
  { value: 'green', label: 'Green', color: '#4fbf6e' },
  { value: 'red', label: 'Red', color: '#e0524f' },
  { value: 'pink', label: 'Pink', color: '#e668a3' },
  { value: 'yellow', label: 'Yellow', color: '#e0c34f' },
  { value: 'violet', label: 'Violet', color: '#9a6fe0' },
  { value: 'orange', label: 'Orange', color: '#e08a3f' },
  { value: 'black', label: 'Black', color: '#a8a8a8' }
];
const filters = [
  ['Chrome', 'Metallic contrast'],
  ['Velvet', 'Deep warm shadows'],
  ['Arctic', 'Cool desaturation'],
  ['Sunset', 'Warm evening tint']
];
const sounds = ['default', 'chime', 'pop', 'marimba'];
const tabs = ['Appearance', 'Chats & alerts', 'Journey'];

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Active membership';
}

export default function GoldSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isGold, setIsGold] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [theme, setTheme] = useState<ThemeName>('gold');
  const [sound, setSound] = useState('default');
  const [digestNotifications, setDigestNotifications] = useState(false);
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [tab, setTab] = useState('Appearance');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const load = async () => {
      const [profileResponse, payResponse, messagesResponse, postsResponse] = await Promise.all([
        authedFetch('/api/profile'),
        authedFetch('/api/wimpypay'),
        authedFetch('/api/messages'),
        authedFetch('/api/posts?current_only=true')
      ]);
      const profilePayload = await profileResponse.json().catch(() => ({}));
      const payPayload = await payResponse.json().catch(() => ({}));
      const messagesPayload = await messagesResponse.json().catch(() => ({}));
      const postsPayload = await postsResponse.json().catch(() => ({}));
      const gold = isGoldSubscription(payPayload.subscription);
      setProfile(profilePayload.profile || null);
      setStreak(profilePayload.streak || null);
      setSubscription(payPayload.subscription || null);
      setIsGold(gold);
      setTheme(profilePayload.profile?.theme_preference || 'gold');
      setSound(profilePayload.profile?.notification_sound || 'default');
      setDigestNotifications(Boolean(profilePayload.profile?.digest_notifications));
      setQuietStart(profilePayload.profile?.quiet_hours_start?.slice?.(0, 5) || '');
      setQuietEnd(profilePayload.profile?.quiet_hours_end?.slice?.(0, 5) || '');
      setLinks(Array.isArray(profilePayload.profile?.custom_links) ? profilePayload.profile.custom_links : []);
      setConversations(messagesPayload.conversations || []);
      setPosts(postsPayload.posts || []);
      setLoading(false);
      if (!gold) window.location.replace('/settings');
    };
    void load();
  }, []);

  const joinedDate = subscription?.created_at || subscription?.start_date;
  const goldPosts = useMemo(() => joinedDate ? posts.filter((post) => new Date(post.createdAt || post.created_at).getTime() >= new Date(joinedDate).getTime()).length : posts.length, [joinedDate, posts]);
  const displayName = profile?.display_name || profile?.username || 'Gold member';

  const saveTheme = async (nextTheme: ThemeName) => {
    applyTheme(nextTheme);
    setTheme(nextTheme);
    const response = await authedFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ theme_preference: nextTheme }) });
    if (!response.ok) setNotice((await response.json()).error || 'Unable to save theme.');
  };

  const saveSound = async (nextSound: string) => {
    setSound(nextSound);
    const response = await authedFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ notification_sound: nextSound }) });
    if (!response.ok) setNotice((await response.json()).error || 'Unable to save sound.');
  };

  const unpin = async (conversationId: string) => {
    const response = await authedFetch('/api/messages/pin', { method: 'PATCH', body: JSON.stringify({ conversationId, pinned: false }) });
    if (response.ok) setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, pinnedAt: null } : item));
  };

  const saveNotificationControls = async (next: Record<string, unknown>) => {
    const response = await authedFetch('/api/profile', { method: 'PATCH', body: JSON.stringify(next) });
    if (!response.ok) setNotice((await response.json()).error || 'Unable to save notification controls.');
  };

  const uploadBanner = async (file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('kind', 'banner');
    formData.append('file', file);
    const response = await authedFetch('/api/upload-profile-media', { method: 'POST', body: formData });
    const payload = await response.json();
    if (response.ok) setProfile((current: any) => ({ ...current, banner_url: payload.bannerUrl }));
    else setNotice(payload.error || 'Unable to upload banner.');
  };

  const saveLinks = async () => {
    const response = await authedFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ custom_links: links }) });
    if (!response.ok) setNotice((await response.json()).error || 'Unable to save links.');
  };

  if (loading || !isGold) return <main className="min-h-screen px-4 py-8"><p className="text-sm text-slate">Loading Gold…</p></main>;

  return (
    <main className="min-h-screen overflow-hidden bg-obsidian px-4 py-8 text-ivory sm:px-6 lg:px-10">
      <div className="gold-membership-shell mx-auto max-w-7xl space-y-6">
        <header className="gold-hero gold-reveal rounded-[2rem] border border-gold/30 p-6 sm:p-10">
          <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="flex items-center gap-5">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt={displayName} className="h-20 w-20 rounded-full object-cover ring-2 ring-gold ring-offset-4 ring-offset-transparent" /> : <div className="grid h-20 w-20 place-items-center rounded-full bg-gold/15 text-3xl font-semibold text-gold ring-2 ring-gold">{displayName.charAt(0).toUpperCase()}</div>}
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-gold">WIMPEX membership home</p>
                <h1 className="mt-2 text-5xl font-semibold tracking-[0.12em] text-ivory sm:text-7xl">GOLD</h1>
                <p className="mt-2 text-sm text-slate">{displayName} · renewing {formatDate(subscription?.current_period_end || subscription?.active_until)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="gold-stat"><strong>{joinedDate ? formatDate(joinedDate) : 'Active'}</strong><span>Joined</span></div>
              <div className="gold-stat"><strong>{posts.length}</strong><span>Posts shown</span></div>
              <div className="gold-stat"><strong>{streak?.longest_count || 0}</strong><span>Longest streak</span></div>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-hairline pb-3">
          {tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === item ? 'bg-gold text-obsidian' : 'bg-ivory/5 text-slate hover:text-ivory'}`}>{item}</button>)}
          <Link href="/settings" className="ml-auto rounded-full border border-hairline px-4 py-2 text-sm text-slate hover:text-ivory">Basic settings</Link>
        </div>

        <div className="flex flex-wrap gap-2 gold-reveal" style={{ animationDelay: '80ms' }}>
          {['9 themes', '3-min posts', 'Search priority', 'Custom sounds', 'Pinned chats', 'Wallpapers'].map((item) => <span key={item} className="rounded-full border border-gold/20 bg-gold/5 px-3 py-2 text-xs font-semibold text-gold">{item}</span>)}
        </div>

        {tab === 'Appearance' ? <section className="gold-reveal space-y-4" style={{ animationDelay: '140ms' }}><div><p className="text-xs uppercase tracking-[0.3em] text-gold">01 · Appearance</p><h2 className="mt-2 text-3xl font-semibold">Make the app feel like yours.</h2><p className="mt-2 text-sm text-slate">Every accent, button, ring, and signal follows your chosen theme.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{themes.map((item) => <button key={item.value} type="button" onClick={() => void saveTheme(item.value)} className={`gold-theme-swatch ${theme === item.value ? 'gold-theme-active' : ''}`}><div className="flex items-center justify-between"><span className="font-semibold text-ivory">{item.label}</span>{theme === item.value ? <span className="text-xs text-gold">Active</span> : null}</div><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="flex justify-end"><span className="rounded-full px-3 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: item.color }}>Gold signal</span></div><div className="mt-3 h-2 w-2/3 rounded-full" style={{ backgroundColor: item.color }} /></div></button>)}</div></section> : null}

        {tab === 'Chats & alerts' ? <section className="grid gap-5 lg:grid-cols-3 gold-reveal" style={{ animationDelay: '140ms' }}><div className="gold-panel lg:col-span-2"><p className="text-xs uppercase tracking-[0.3em] text-gold">02 · Chats</p><h2 className="mt-2 text-2xl font-semibold">Your pinned orbit</h2><p className="mt-2 text-sm text-slate">Keep the conversations you care about within reach.</p><div className="mt-5 space-y-2">{conversations.filter((item) => item.pinnedAt).map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl border border-hairline bg-panel/60 p-3"><span className="text-sm text-ivory">{item.title || item.otherUser?.display_name || 'Conversation'}</span><button type="button" onClick={() => void unpin(item.id)} className="text-xs text-gold">Unpin</button></div>)}{conversations.filter((item) => item.pinnedAt).length === 0 ? <p className="rounded-2xl border border-dashed border-hairline p-4 text-sm text-slate">No pinned chats yet. Pin one from your inbox.</p> : null}</div><Link href="/messages" className="mt-5 inline-flex text-sm font-semibold text-gold">Open a chat to set its wallpaper →</Link></div><div className="gold-panel"><p className="text-xs uppercase tracking-[0.3em] text-gold">Notifications</p><h2 className="mt-2 text-2xl font-semibold">Your sound signature</h2><div className="mt-5 space-y-2">{sounds.map((item) => <label key={item} className="flex items-center gap-3 rounded-2xl border border-hairline bg-panel/60 p-3 text-sm text-ivory"><input type="radio" name="gold-sound" checked={sound === item} onChange={() => void saveSound(item)} />{item === 'default' ? 'Default' : item.charAt(0).toUpperCase() + item.slice(1)}</label>)}</div><p className="mt-4 text-xs text-slate">Precise read times are automatically visible on messages you send as a Gold member.</p></div></section> : null}

        {tab === 'Journey' ? <section className="grid gap-5 lg:grid-cols-2 gold-reveal" style={{ animationDelay: '140ms' }}><div className="gold-panel"><p className="text-xs uppercase tracking-[0.3em] text-gold">03 · Creator perks</p><h2 className="mt-2 text-2xl font-semibold">More room to make.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{filters.map(([name, detail]) => <div key={name} className="rounded-2xl border border-gold/20 bg-gold/5 p-4"><div className="h-12 rounded-xl bg-gradient-to-br from-gold/40 to-panel" /><p className="mt-3 font-semibold text-ivory">{name}</p><p className="mt-1 text-xs text-slate">{detail}</p></div>)}</div><p className="mt-5 text-sm text-slate"><strong className="text-ivory">Record up to 3 minutes</strong>, up from 1 minute on the free tier.</p></div><div className="gold-panel"><p className="text-xs uppercase tracking-[0.3em] text-gold">Gold journey</p><h2 className="mt-2 text-2xl font-semibold">Keep your momentum visible.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-gold/5 p-3"><strong className="block text-xl text-ivory">{streak?.longest_count || 0}</strong><span className="text-xs text-slate">Longest streak</span></div><div className="rounded-2xl bg-gold/5 p-3"><strong className="block text-xl text-ivory">{goldPosts}</strong><span className="text-xs text-slate">Posts as Gold</span></div></div><div className="mt-5 space-y-4"><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-gold" /><div><p className="text-sm font-semibold text-ivory">Gold activated</p><p className="text-xs text-slate">{formatDate(joinedDate)}</p></div></div><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-gold/60" /><div><p className="text-sm font-semibold text-ivory">Latest highlight</p><p className="text-xs text-slate">New: custom notification sounds.</p></div></div><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-gold/30" /><div><p className="text-sm font-semibold text-ivory">Membership</p><p className="text-xs text-slate">Renews {formatDate(subscription?.current_period_end || subscription?.active_until)}</p></div></div></div><Link href="/messages" className="mt-6 inline-flex rounded-full bg-gold px-4 py-2 text-sm font-semibold text-obsidian">Explore your chats</Link></div></section> : null}

        <section className="gold-panel gold-reveal">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Creator intelligence</p>
          <h2 className="mt-2 text-2xl font-semibold">See what your posts are doing.</h2>
          <p className="mt-2 text-sm text-slate">Gold analytics uses views, watch time, likes, and shares already recorded by Wimpex.</p>
          {posts.slice(0, 5).length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{posts.slice(0, 5).map((post) => <Link key={post.id} href={`/post/${post.id}/analytics`} className="rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/10">{post.caption || 'View post'} analytics</Link>)}</div> : <p className="mt-4 text-sm text-slate">Publish a post to unlock its analytics.</p>}
        </section>
        <section className="gold-panel gold-reveal">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Content calendar</p>
          <h2 className="mt-2 text-2xl font-semibold">Your upcoming posts.</h2>
          <div className="mt-4 space-y-2">{posts.filter((post) => post.scheduled_for).map((post) => <div key={post.id} className="flex items-center justify-between rounded-2xl border border-hairline bg-panel/60 p-3 text-sm"><span className="truncate text-ivory">{post.caption || 'Scheduled post'}</span><time className="ml-3 whitespace-nowrap text-xs text-gold">{new Date(post.scheduled_for).toLocaleString()}</time></div>)}{posts.filter((post) => post.scheduled_for).length === 0 ? <p className="text-sm text-slate">No scheduled posts yet. Schedule one from the composer.</p> : null}</div>
        </section>
        <section className="gold-panel gold-reveal">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Account care</p>
          <h2 className="mt-2 text-2xl font-semibold">Take your data with you.</h2>
          <p className="mt-2 text-sm text-slate">Download your profile, posts, sent messages, and notifications as a portable JSON archive.</p>
          <a href="/api/account/export" className="mt-4 inline-flex rounded-full bg-gold px-4 py-2 text-sm font-semibold text-obsidian">Download data export</a>
        </section>
        <section className="gold-panel gold-reveal">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">WimpyAI</p>
          <h2 className="mt-2 text-2xl font-semibold">More room to think.</h2>
          <p className="mt-2 text-sm text-slate">Gold members get a 100-message daily AI allowance, compared with 20 on the free tier.</p>
          <Link href="/messages/wimpyai" className="mt-4 inline-flex rounded-full border border-gold/40 px-4 py-2 text-sm font-semibold text-gold">Open WimpyAI</Link>
        </section>
        <section className="gold-panel gold-reveal">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Identity</p>
          <h2 className="mt-2 text-2xl font-semibold">Know your audience.</h2>
          <p className="mt-2 text-sm text-slate">Profile insights show recent members who visited your profile, using privacy-respecting aggregate visits.</p>
          <Link href="/profile" className="mt-4 inline-flex rounded-full border border-gold/40 px-4 py-2 text-sm font-semibold text-gold">View profile insights</Link>
        </section>
        <section className="gold-panel gold-reveal grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">Profile studio</p>
            <h2 className="mt-2 text-2xl font-semibold">A little more of you.</h2>
            <p className="mt-2 text-sm text-slate">Add a cover image and up to five external links to your profile.</p>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadBanner(event.target.files?.[0] || null)} className="mt-4 block w-full text-xs text-slate" />
            {profile?.banner_url ? <img src={profile.banner_url} alt="Current profile banner" className="mt-3 h-20 w-full rounded-xl object-cover" /> : null}
            <div className="mt-4 space-y-2">{links.map((link, index) => <div key={index} className="flex gap-2"><input value={link.label} onChange={(event) => setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} placeholder="Label" className="w-1/3 rounded-xl border border-hairline bg-panel px-2 py-2 text-xs text-ivory" /><input value={link.url} onChange={(event) => setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} placeholder="https://" className="flex-1 rounded-xl border border-hairline bg-panel px-2 py-2 text-xs text-ivory" /></div>)}</div>
            {links.length < 5 ? <button type="button" onClick={() => setLinks((current) => [...current, { label: '', url: 'https://' }])} className="mt-3 text-xs text-gold">Add link</button> : null}
            <button type="button" onClick={() => void saveLinks()} className="mt-3 ml-3 rounded-full bg-gold px-3 py-2 text-xs font-semibold text-obsidian">Save links</button>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">Quiet intelligence</p>
            <h2 className="mt-2 text-2xl font-semibold">Less noise, more signal.</h2>
            <label className="mt-4 flex items-center gap-2 text-sm text-ivory"><input type="checkbox" checked={digestNotifications} onChange={(event) => { setDigestNotifications(event.target.checked); void saveNotificationControls({ digest_notifications: event.target.checked }); }} /> Bundle low-priority notifications</label>
            <div className="mt-4 grid grid-cols-2 gap-2"><label className="text-xs text-slate">Quiet starts<input type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-panel px-2 py-2 text-sm text-ivory" /></label><label className="text-xs text-slate">Quiet ends<input type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-panel px-2 py-2 text-sm text-ivory" /></label></div>
            <button type="button" onClick={() => void saveNotificationControls({ quiet_hours_start: quietStart || null, quiet_hours_end: quietEnd || null })} className="mt-3 rounded-full border border-gold/40 px-3 py-2 text-xs font-semibold text-gold">Save quiet hours</button>
          </div>
        </section>
        {notice ? <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">{notice}</p> : null}
        <footer className="gold-panel flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-ivory">Gold is active on this account.</p><p className="mt-1 text-xs text-slate">Manage billing through your WimpyPay membership.</p></div><Link href="/settings" className="rounded-full border border-gold/40 px-4 py-2 text-sm font-semibold text-gold">Billing settings</Link></footer>
      </div>
    </main>
  );
}
