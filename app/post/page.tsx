"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserAccent } from '@/lib/ui-theme';
import { authedFetch } from '@/lib/api-client';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';

const FILTER_PRESETS = [
  { key: 'none', label: 'None', description: 'Natural colors' },
  { key: 'vivid', label: 'Vivid', description: 'High contrast and saturation' },
  { key: 'mono', label: 'Mono', description: 'Black and white' },
  { key: 'warm', label: 'Warm', description: 'Soft golden tones' },
  { key: 'cool', label: 'Cool', description: 'Crisp blue shadows' },
  { key: 'neon', label: 'Neon', description: 'Bright, punchy glow' }
];

const filterClasses: Record<string, string> = {
  none: '',
  vivid: 'filter saturate-150 contrast-110',
  mono: 'filter grayscale contrast-110',
  warm: 'filter sepia contrast-105 saturate-110',
  cool: 'filter hue-rotate-190 saturate-120 contrast-105',
  neon: 'filter saturate-200 drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]'
};

export default function CreatePostPage() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'private'>('public');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [filterPreset, setFilterPreset] = useState('none');
  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [trackResults, setTrackResults] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [session, setSession] = useState<any | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId) setEditingId(editId);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } | null }) => {
      setSession(result?.data?.session ?? null);
    });
  }, []);

  useEffect(() => {
    if (!editingId) return;
    const load = async () => {
      try {
        const resp = await authedFetch(`/api/posts/${editingId}`);
        if (!resp.ok) return;
        const json = await resp.json();
        const post = json.post;
        if (post) {
          setDraft(post.caption || '');
          setVisibility(post.visibility || 'public');
          setMediaType(post.mediaType || 'video');
          setFilterPreset(post.filterPreset || 'none');
          if (post.imageUrl) {
            setMediaFile(null);
            setPreviewUrl(post.imageUrl);
          } else if (post.videoUrl) {
            setMediaFile(null);
            setPreviewUrl(post.videoUrl);
          }
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, [editingId]);

  useEffect(() => {
    if (!mediaFile) {
      return;
    }

    const nextUrl = URL.createObjectURL(mediaFile);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [mediaFile]);

  useEffect(() => {
    if (!spotifyQuery.trim()) {
      setTrackResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setTrackResults([]);
      try {
        const resp = await fetch(`/api/spotify/search?q=${encodeURIComponent(spotifyQuery.trim())}`);
        const payload = await resp.json();
        if (resp.ok) {
          setTrackResults(payload.tracks || []);
        }
      } catch {
        // ignore
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [spotifyQuery]);

  const accent = useMemo(() => getUserAccent(session?.user?.id ?? 'post-creator'), [session?.user?.id]);
  const characterCount = draft.length;

  const handleMediaChange = (file: File | null) => {
    if (!file) {
      setMediaFile(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      setMediaType('image');
      setMediaFile(file);
      setSelectedTrack(selectedTrack);
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
      setMediaFile(file);
    } else {
      setError('Unsupported file type. Choose an image or video.');
      setMediaFile(null);
    }
  };

  const selectTrack = (track: any) => {
    setSelectedTrack(track);
    setSpotifyQuery('');
    setTrackResults([]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) {
      return;
    }

    if (!draft.trim() && !mediaFile && !previewUrl) {
      setError('Add a caption and upload an image or video before publishing.');
      return;
    }

    if (!mediaFile && !previewUrl) {
      setError('Please attach an image or video to publish your post.');
      return;
    }

    setBusy(true);
    setError('');

    if (editingId) {
      const response = await authedFetch(`/api/posts/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption: draft.trim(), visibility, filter_preset: filterPreset })
      });
      setBusy(false);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || 'Unable to update post.');
        return;
      }
      router.push(`/post/${editingId}?edited=1`);
      return;
    }

    const formData = new FormData();
    if (mediaFile) {
      formData.append(mediaType === 'image' ? 'image' : 'video', mediaFile);
      formData.append('media_type', mediaType);
    }
    formData.append('caption', draft.trim());
    formData.append('visibility', visibility);
    formData.append('filter_preset', filterPreset);

    if (selectedTrack) {
      formData.append('audio_track_id', selectedTrack.id);
      formData.append('audio_track_name', selectedTrack.title);
      formData.append('audio_artist_name', selectedTrack.artist);
      formData.append('audio_preview_url', selectedTrack.preview_url || '');
      formData.append('audio_cover_art_url', selectedTrack.cover_art_url || '');
    }

    const response = await authedFetch('/api/posts', {
      method: 'POST',
      body: formData
    });

    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || 'Unable to publish post.');
      return;
    }

    router.push('/feed?created=1');
  };

  if (session === undefined) {
    return (
      <main className="min-h-[70vh] px-2 py-4 sm:px-6 lg:px-8">
        <p className="text-sm text-slate">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthActionPrompt
        title="Sign in to publish a post"
        description="You can browse public posts, but publishing requires a WimpyID login or signup."
      />
    );
  }

  return (
    <main className="min-h-[70vh] px-2 py-4 sm:px-6 lg:px-8">
      <section className={`surface-veil rounded-md border border-hairline bg-panel-2/80 p-6 shadow-2xl ${accent.glow} sm:p-8`}>
        <div className={`rounded-[1.6rem] bg-gradient-to-r ${accent.gradient} p-[1px]`}>
          <div className="rounded-[calc(1.6rem-1px)] bg-panel/90 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate">Create</p>
                <h1 className="text-display mt-2 text-3xl text-ivory">Share a new post</h1>
              </div>
              <div className={`rounded-full border border-hairline bg-gradient-to-r ${accent.gradient} px-3 py-1 text-sm font-semibold text-slate-950`}>
                {visibility === 'public' ? 'Public' : visibility === 'connections' ? 'Connections only' : 'Private'}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
                <div className="rounded-md border border-hairline bg-panel-2/70 p-4">
                  <label className="block text-sm font-medium text-slate">Add media</label>
                  <label className="mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-hairline bg-panel/70 px-4 py-6 text-sm text-slate transition hover:bg-panel-2">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="sr-only"
                      onChange={(event) => handleMediaChange(event.target.files?.[0] || null)}
                    />
                    {mediaFile ? `Selected: ${mediaFile.name}` : previewUrl ? 'Using existing media preview' : 'Drop an image or video or tap to choose'}
                  </label>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {FILTER_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setFilterPreset(preset.key)}
                        className={`rounded-2xl border px-3 py-2 text-left text-sm ${filterPreset === preset.key ? 'border-amber-400 bg-gold/10 text-ivory' : 'border-hairline text-slate hover:border-white/20 hover:bg-ivory/5'}`}
                      >
                        <p className="font-semibold">{preset.label}</p>
                        <p className="text-xs text-slate">{preset.description}</p>
                      </button>
                    ))}
                  </div>

                  {previewUrl ? (
                    <div className={`mt-4 overflow-hidden rounded-md border border-hairline bg-panel-2/70 ${filterClasses[filterPreset]}`}>
                      {mediaType === 'image' ? (
                        <img src={previewUrl} alt={draft || 'Post preview'} className="h-[40vh] w-full object-cover md:h-72" />
                      ) : (
                        <video controls src={previewUrl} className="h-[40vh] w-full object-cover md:h-72" />
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 flex h-56 items-center justify-center rounded-md border border-hairline bg-panel/60 text-sm text-slate">
                      Your image or video preview will appear here.
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-hairline bg-panel-2/70 p-4">
                  <label className="block text-sm font-medium text-slate">Spotify audio</label>
                  <input
                    value={spotifyQuery}
                    onChange={(event) => {
                      setSpotifyQuery(event.target.value);
                      setSelectedTrack(null);
                    }}
                    placeholder="Search for a track to attach"
                    className="mt-3 w-full rounded-md border border-hairline bg-panel px-4 py-3 text-sm text-ivory outline-none"
                  />
                  {trackResults.length > 0 ? (
                    <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                      {trackResults.map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => selectTrack(track)}
                          className="w-full rounded-2xl border border-hairline bg-panel/80 px-4 py-3 text-left text-sm text-ivory transition hover:border-hairline-strong hover:bg-panel-2"
                        >
                          <p className="font-semibold">{track.title}</p>
                          <p className="text-xs text-slate">{track.artist}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {selectedTrack ? (
                    <div className="mt-4 rounded-md border border-amber-400/20 bg-panel/90 p-4 text-sm text-ivory">
                      <div className="flex items-center gap-3">
                        {selectedTrack.cover_art_url ? (
                          <img src={selectedTrack.cover_art_url} alt={`${selectedTrack.title} cover`} className="h-14 w-14 rounded-2xl object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-2 text-xs uppercase tracking-[0.25em] text-slate">Audio</div>
                        )}
                        <div>
                          <p className="font-semibold text-ivory">{selectedTrack.title}</p>
                          <p className="text-xs text-slate">{selectedTrack.artist}</p>
                        </div>
                      </div>
                      {selectedTrack.preview_url ? (
                        <audio controls src={selectedTrack.preview_url} className="mt-4 w-full" />
                      ) : (
                        <p className="mt-4 text-xs text-slate">No preview available for this track.</p>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-6 rounded-md border border-hairline bg-gradient-to-r from-slate-900 to-slate-950 p-[1px]">
                    <div className="rounded-[calc(1.2rem-1px)] bg-panel/90 p-4 text-sm text-slate">
                      <p className="font-semibold text-ivory">Visibility</p>
                      <p className="mt-2 text-slate">Choose who can see this post once it goes live.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate">Caption</label>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={280}
                  placeholder="What are you sharing today?"
                  className="min-h-[120px] w-full rounded-md border border-hairline bg-panel-2 px-4 py-3 text-sm text-ivory outline-none"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate">
                  <span>Keep it concise and intimate.</span>
                  <span>{characterCount}/280</span>
                </div>
              </div>

              {error ? <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate">Posting uses the same upload logic as the feed composer.</p>
                <button
                  type="submit"
                  className={`rounded-md bg-gradient-to-r ${accent.gradient} px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={busy}
                >
                  {busy ? 'Publishing…' : editingId ? 'Update post' : 'Publish post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
