"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import { authedFetch } from '@/lib/api-client';

type StoryOverlay = {
  text: string;
  font: string | null;
  textColor: string | null;
  bgColor: string | null;
  posX: number | null;
  posY: number | null;
  scale: number | null;
  rotation: number | null;
};

type StoryItem = {
  id: string;
  authorId: string;
  author: string;
  avatarUrl: string | null;
  caption: string;
  createdAt: string;
  mediaType: 'video' | 'image' | 'text';
  videoUrl: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  viewedByMe: boolean;
  // Present only when mediaType === 'text'
  textContent?: string | null;
  backgroundColor?: string | null;
  font?: string | null;
  // Present only when the author added a text layer on top of video/image
  overlay?: StoryOverlay | null;
};

type StoryGroup = {
  authorId: string;
  author: string;
  avatarUrl: string | null;
  stories: StoryItem[];
};

// Keep in sync with FONT_OPTIONS in stories-create-page.tsx — same ids,
// same stacks, so a story renders with the exact font it was composed in.
const FONT_STACKS: Record<string, string> = {
  sans: '"Inter", "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", ui-monospace, Menlo, monospace',
  display: '"Arial Black", "Helvetica Neue", sans-serif',
  script: '"Segoe Script", "Bradley Hand", cursive'
};

function fontFamilyFor(id: string | null | undefined) {
  return FONT_STACKS[id || 'sans'] || FONT_STACKS.sans;
}

// Keep in sync with BACKGROUND_OPTIONS in stories-create-page.tsx — solid
// hex values pass through as-is, "grad-*" tokens resolve to the matching
// gradient here.
const BACKGROUND_CSS: Record<string, string> = {
  'grad-gold-obsidian': 'linear-gradient(160deg, #D4AF37 0%, #141014 70%)',
  'grad-rose-obsidian': 'linear-gradient(160deg, #E11D48 0%, #141014 75%)',
  'grad-slate-gold': 'linear-gradient(160deg, #1F2937 0%, #D4AF37 100%)'
};

function backgroundCssFor(value: string | null | undefined) {
  if (!value) return '#141014';
  return BACKGROUND_CSS[value] || value;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function StoryOverlayLayer({ overlay }: { overlay: StoryOverlay }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${overlay.posX ?? 50}%`,
        top: `${overlay.posY ?? 50}%`,
        transform: `translate(-50%, -50%) rotate(${overlay.rotation ?? 0}deg) scale(${overlay.scale ?? 1})`,
        fontFamily: fontFamilyFor(overlay.font),
        color: overlay.textColor || '#ffffff',
        backgroundColor: overlay.bgColor || 'transparent',
        padding: overlay.bgColor ? '0.35em 0.6em' : 0,
        borderRadius: overlay.bgColor ? '0.5em' : 0,
        maxWidth: '85%',
        fontSize: '1.15rem',
        fontWeight: 600,
        textAlign: 'center',
        lineHeight: 1.25,
        wordBreak: 'break-word'
      }}
    >
      {overlay.text}
    </div>
  );
}

export default function StoriesPage() {
  const [ownAvatarUrl, setOwnAvatarUrl] = useState<string | null>(null);
  const [ownName, setOwnName] = useState('You');
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [archive, setArchive] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [highlightTitle, setHighlightTitle] = useState('');
  const [highlightStoryId, setHighlightStoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewer, setViewer] = useState<{ groupIndex: number; storyIndex: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);

  const loadStories = async () => {
    try {
      const [profileResp, storiesResp, archiveResp, highlightsResp] = await Promise.all([authedFetch('/api/profile'), authedFetch('/api/stories'), authedFetch('/api/stories/archive'), authedFetch('/api/stories/highlights')]);
      const profileJson = await profileResp.json();
      const storiesJson = await storiesResp.json();
      const archiveJson = await archiveResp.json();
      const highlightsJson = await highlightsResp.json();

      setOwnAvatarUrl(profileJson.profile?.avatar_url ?? null);
      setOwnName(profileJson.profile?.display_name || profileJson.profile?.username || 'You');
      setArchive(archiveJson.stories || []);
      setHighlights(highlightsJson.highlights || []);

      const items: StoryItem[] = storiesJson.stories || [];
      const initiallyViewed = new Set(items.filter((s) => s.viewedByMe).map((s) => s.id));
      setViewedIds(initiallyViewed);

      const byAuthor = new Map<string, StoryGroup>();
      items.forEach((story) => {
        // Own stories are shown via the "Your story" bubble, not repeated
        // in the rail below.
        if (story.authorId === profileJson.profile?.user_id) return;
        const existing = byAuthor.get(story.authorId);
        if (existing) {
          existing.stories.push(story);
        } else {
          byAuthor.set(story.authorId, {
            authorId: story.authorId,
            author: story.author,
            avatarUrl: story.avatarUrl,
            stories: [story]
          });
        }
      });

      setGroups(Array.from(byAuthor.values()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load stories.');
    } finally {
      setLoading(false);
    }
  };

  const addHighlight = async () => {
    if (!highlightStoryId || !highlightTitle.trim()) return;
    const response = await authedFetch('/api/stories/highlights', { method: 'POST', body: JSON.stringify({ story_id: highlightStoryId, title: highlightTitle }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setHighlights((current) => [...current.filter((item) => item.story_id !== payload.highlight.story_id), payload.highlight]);
      setHighlightTitle('');
      setHighlightStoryId('');
    } else setError(payload.error || 'Unable to save highlight.');
  };

  const removeHighlight = async (id: string) => {
    const response = await authedFetch(`/api/stories/highlights?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) setHighlights((current) => current.filter((item) => item.id !== id));
  };

  useEffect(() => {
    void loadStories();
  }, []);

  const activeGroup = viewer ? groups[viewer.groupIndex] : null;
  const activeStory = activeGroup ? activeGroup.stories[viewer!.storyIndex] : null;

  const markViewed = (story: StoryItem) => {
    if (viewedIds.has(story.id)) return;
    setViewedIds((prev) => new Set(prev).add(story.id));
    void authedFetch('/api/stories/view', { method: 'POST', body: JSON.stringify({ story_id: story.id }) }).catch(() => undefined);
  };

  const goToStory = (groupIndex: number, storyIndex: number) => {
    if (groupIndex < 0 || groupIndex >= groups.length) {
      setViewer(null);
      return;
    }
    const group = groups[groupIndex];
    if (storyIndex < 0) {
      goToStory(groupIndex - 1, groups[groupIndex - 1] ? groups[groupIndex - 1].stories.length - 1 : 0);
      return;
    }
    if (storyIndex >= group.stories.length) {
      goToStory(groupIndex + 1, 0);
      return;
    }
    setProgress(0);
    setViewer({ groupIndex, storyIndex });
  };

  useEffect(() => {
    if (activeStory) markViewed(activeStory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory?.id]);

  // Videos advance via onEnded below; images AND text stories auto-advance
  // on a fixed timer since neither has a natural "finished playing" event.
  useEffect(() => {
    if (!activeStory || activeStory.mediaType === 'video') return undefined;
    const duration = 5000;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(1, elapsed / duration));
      if (elapsed >= duration) {
        goToStory(viewer!.groupIndex, viewer!.storyIndex + 1);
      } else {
        timerRef.current = window.requestAnimationFrame(tick);
      }
    };
    timerRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (timerRef.current) window.cancelAnimationFrame(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory?.id]);

  const hasUnseen = (group: StoryGroup) => group.stories.some((s) => !viewedIds.has(s.id));

  return (
    <main className="space-y-6">
      <section className="surface-veil rounded-md bg-panel-2/75 p-6">
        <h1 className="text-display text-3xl text-ivory">Stories</h1>
        <p className="mt-2 text-sm text-slate">Photos, clips, and text from people you follow back — gone after 24 hours.</p>
      </section>

      {/* Avatar rail — your story bubble first, tap it to go straight to the story composer */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        <Link href="/stories/create" className="flex w-20 shrink-0 flex-col items-center gap-2">
          <span className="relative">
            {ownAvatarUrl ? (
              <img src={ownAvatarUrl} alt={ownName} className="h-16 w-16 rounded-full object-cover ring-2 ring-hairline" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-full bg-panel-2 text-lg font-semibold text-slate ring-2 ring-hairline">
                {ownName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-gold text-obsidian ring-2 ring-obsidian">
              <IconPlus className="h-3.5 w-3.5" />
            </span>
          </span>
          <span className="max-w-full truncate text-xs text-slate">Your story</span>
        </Link>

        {groups.map((group, groupIndex) => (
          <button
            key={group.authorId}
            type="button"
            onClick={() => goToStory(groupIndex, 0)}
            className="flex w-20 shrink-0 flex-col items-center gap-2"
          >
            <span className={`rounded-full p-[2px] ${hasUnseen(group) ? 'bg-gradient-to-tr from-gold via-gold-deep to-gold' : 'bg-hairline'}`}>
              {group.avatarUrl ? (
                <img src={group.avatarUrl} alt={group.author} className="h-16 w-16 rounded-full border-2 border-panel-2 object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-panel-2 bg-panel-2 text-lg font-semibold text-slate">
                  {group.author.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="max-w-full truncate text-xs text-slate">{group.author}</span>
          </button>
        ))}
      </div>

      <section className="surface-veil rounded-md bg-panel-2/75 p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-gold">Your archive</p>
        <div className="mt-3 flex flex-wrap gap-2">{highlights.map((item) => <span key={item.id} className="flex items-center gap-2 rounded-full border border-gold/20 px-3 py-2 text-xs text-ivory">{item.title}<button type="button" onClick={() => void removeHighlight(item.id)} aria-label={`Remove ${item.title} highlight`} className="text-slate hover:text-rose-200">×</button></span>)}{highlights.length === 0 ? <span className="text-sm text-slate">No highlights yet.</span> : null}</div>
        {archive.length > 0 ? <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void addHighlight(); }}><select value={highlightStoryId} onChange={(event) => setHighlightStoryId(event.target.value)} className="rounded-xl border border-hairline bg-panel px-3 py-2 text-sm text-ivory"><option value="">Choose an archived story</option>{archive.slice(0, 20).map((story) => <option key={story.id} value={story.id}>{story.caption || story.text_content || new Date(story.created_at).toLocaleDateString()}</option>)}</select><input value={highlightTitle} onChange={(event) => setHighlightTitle(event.target.value)} maxLength={40} placeholder="Highlight name" className="rounded-xl border border-hairline bg-panel px-3 py-2 text-sm text-ivory" /><button type="submit" disabled={!highlightStoryId || !highlightTitle.trim()} className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-obsidian disabled:opacity-50">Add highlight</button></form> : <p className="mt-3 text-xs text-slate">Your expired stories will stay here as an archive.</p>}
      </section>

      {loading ? <p className="text-sm text-slate">Loading stories…</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {!loading && !error && groups.length === 0 ? (
        <section className="surface-veil rounded-md bg-panel-2/75 p-8 text-center">
          <p className="text-sm text-slate">No active stories right now.</p>
          <p className="mt-1 text-xs text-slate">Tap your avatar above to post one.</p>
        </section>
      ) : null}

      {/* Full-screen story viewer */}
      {activeGroup && activeStory ? (
        <div className="fixed inset-0 z-50 bg-black">
          <div
            className="relative mx-auto h-full max-w-md"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x < rect.width / 2) {
                goToStory(viewer!.groupIndex, viewer!.storyIndex - 1);
              } else {
                goToStory(viewer!.groupIndex, viewer!.storyIndex + 1);
              }
            }}
          >
            <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
              {activeGroup.stories.map((story, i) => (
                <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full bg-white transition-[width] duration-100 ease-linear"
                    style={{ width: i < viewer!.storyIndex ? '100%' : i === viewer!.storyIndex ? `${progress * 100}%` : '0%' }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute inset-x-3 top-7 z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeGroup.avatarUrl ? (
                  <img src={activeGroup.avatarUrl} alt={activeGroup.author} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/30" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-xs text-slate ring-1 ring-white/30">
                    {activeGroup.author.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-ivory">{activeGroup.author}</p>
                  <p className="text-[11px] text-white/70">{timeAgo(activeStory.createdAt)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewer(null);
                }}
                aria-label="Close story"
                className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-ivory"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-full items-center justify-center">
              {activeStory.mediaType === 'text' ? (
                <div
                  className="flex h-full w-full items-center justify-center p-8 text-center"
                  style={{ background: backgroundCssFor(activeStory.backgroundColor) }}
                >
                  <p
                    style={{ fontFamily: fontFamilyFor(activeStory.font) }}
                    className="whitespace-pre-wrap break-words text-2xl font-semibold text-ivory"
                  >
                    {activeStory.textContent}
                  </p>
                </div>
              ) : activeStory.mediaType === 'video' && activeStory.videoUrl ? (
                <div className="relative h-full w-full">
                  <video
                    key={activeStory.id}
                    src={activeStory.videoUrl}
                    poster={activeStory.thumbnailUrl ?? undefined}
                    className="h-full w-full object-contain"
                    autoPlay
                    playsInline
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      if (v.duration) setProgress(v.currentTime / v.duration);
                    }}
                    onEnded={() => goToStory(viewer!.groupIndex, viewer!.storyIndex + 1)}
                  />
                  {activeStory.overlay?.text ? <StoryOverlayLayer overlay={activeStory.overlay} /> : null}
                </div>
              ) : activeStory.imageUrl ? (
                <div className="relative h-full w-full">
                  <img src={activeStory.imageUrl} alt={activeStory.caption || 'Story'} className="h-full w-full object-contain" />
                  {activeStory.overlay?.text ? <StoryOverlayLayer overlay={activeStory.overlay} /> : null}
                </div>
              ) : (
                <p className="text-sm text-slate">No media available.</p>
              )}
            </div>

            {activeStory.mediaType !== 'text' && activeStory.caption ? (
              <p className="absolute inset-x-4 bottom-6 z-10 text-center text-sm text-ivory drop-shadow">{activeStory.caption}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}