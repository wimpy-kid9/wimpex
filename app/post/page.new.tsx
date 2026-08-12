"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
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
  { key: 'neon', label: 'Neon', description: 'Bright, punchy glow' },
  { key: 'dreamy', label: 'Dreamy', description: 'Soft glow and pastel highlights' },
  { key: 'noir', label: 'Noir', description: 'High contrast black and white' },
  { key: 'retro', label: 'Retro', description: 'Warm vintage saturation' },
  { key: 'duotone', label: 'Duotone', description: 'Bold color contrast' },
  { key: 'golden', label: 'Golden Hour', description: 'Warm evening tones' },
  { key: 'cyberpunk', label: 'Cyberpunk', description: 'Neon pink and blue lighting' },
  { key: 'pastel', label: 'Pastel', description: 'Soft color wash' },
  { key: 'infrared', label: 'Infrared', description: 'Dreamy magenta tint' }
];

const filterClasses: Record<string, string> = {
  none: '',
  vivid: 'filter saturate-150 contrast-110',
  mono: 'filter grayscale contrast-110',
  warm: 'filter sepia contrast-105 saturate-110',
  cool: 'filter hue-rotate-190 saturate-120 contrast-105',
  neon: 'filter saturate-200 drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]',
  dreamy: 'filter saturate-110 contrast-105 brightness-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.12)]',
  noir: 'filter grayscale contrast-130 brightness-90',
  retro: 'filter sepia contrast-110 saturate-110',
  duotone: 'filter contrast-125 saturate-150',
  golden: 'filter sepia brightness-110 contrast-105',
  cyberpunk: 'filter hue-rotate-280 saturate-180 contrast-120',
  pastel: 'filter brightness-110 saturate-120 contrast-95',
  infrared: 'filter hue-rotate-310 saturate-140 contrast-115'
};

type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  preview_url?: string;
  cover_art_url?: string;
};

export default function CreatePostPage() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'private'>('public');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [filterPreset, setFilterPreset] = useState('none');
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<AudioTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [session, setSession] = useState<any | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState<'media' | 'details'>('media');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEditingId(params.get('edit'));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } | null }) => {
      setSession(result?.data?.session ?? null);
    });
  }, []);

  useEffect(() => {
    if (!editingId) return;

    const loadPost = async () => {
      try {
        const response = await authedFetch(`/api/posts/${editingId}`);
        if (!response.ok) return;
        const payload = await response.json();
        const post = payload.post;
        if (!post) return;

        setDraft(post.caption || '');
        setVisibility(post.visibility || 'public');
        setFilterPreset(post.filter_preset || 'none');
        setStatus(post.status || 'published');

        if (post.imageUrl) {
          setMediaType('image');
          setMediaFile(null);
          setPreviewUrl(post.imageUrl);
        } else if (post.videoUrl) {
          setMediaType('video');
          setMediaFile(null);
          setPreviewUrl(post.videoUrl);
        }

        if (post.audio_track_id) {
          setSelectedTrack({
            id: post.audio_track_id,
            title: post.audio_track_name || 'Unknown track',
            artist: post.audio_artist_name || 'Unknown artist',
            preview_url: post.audio_preview_url || undefined,
            cover_art_url: post.audio_cover_art_url || undefined
          });
        }
      } catch {
        // ignore
      }
    };

    void loadPost();
  }, [editingId]);

  useEffect(() => {
    if (!mediaFile) return;
    const objectUrl = URL.createObjectURL(mediaFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setAudioTime(audio.currentTime);
    const handleLoadedMeta = () => setAudioDuration(audio.duration || 0);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMeta);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMeta);
    };
  }, [selectedTrack]);

  useEffect(() => {
    if (!trackQuery.trim()) {
      setTrackResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/audio/search?q=${encodeURIComponent(trackQuery.trim())}`);
        const payload = await response.json();
        if (response.ok) {
          setTrackResults(payload.tracks || []);
        }
      } catch {
        // ignore
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [trackQuery]);

  const accent = useMemo(() => getUserAccent(session?.user?.id ?? 'post-creator'), [session?.user?.id]);
  const characterCount = draft.length;

  const handleMediaChange = (file: File | null) => {
    setError('');
    if (!file) {
      setMediaFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      setMediaType('image');
      setMediaFile(file);
      return;
    }

    if (file.type.startsWith('video/')) {
      setMediaType('video');
      setMediaFile(file);
      return;
    }

    setError('Unsupported file type. Choose an image or video.');
    setMediaFile(null);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeMedia = () => {
    setMediaFile(null);
    setPreviewUrl(null);
    setSelectedTrack(null);
    setTrackQuery('');
    setTrackResults([]);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] ?? null;
    handleMediaChange(file);
  };

  const selectTrack = (track: AudioTrack) => {
    setSelectedTrack(track);
    setTrackQuery('');
    setTrackResults([]);
  };

  const submitPost = async (desiredStatus: 'published' | 'draft') => {
    if (!session) {
      return;
    }

    if (desiredStatus === 'published' && !draft.trim() && !previewUrl) {
      setError('Add a caption and media before publishing.');
      return;
    }

    setBusy(true);
    setError('');

    const formData = new FormData();
    if (mediaFile) {
      formData.append(mediaType === 'image' ? 'image' : 'video', mediaFile);
      formData.append('media_type', mediaType);
    }

    formData.append('caption', draft.trim());
    formData.append('visibility', visibility);
    formData.append('status', desiredStatus);
    formData.append('filter_preset', filterPreset);

    if (selectedTrack) {
      formData.append('audio_track_id', selectedTrack.id);
      formData.append('audio_track_name', selectedTrack.title);
      formData.append('audio_artist_name', selectedTrack.artist);
      formData.append('audio_preview_url', selectedTrack.preview_url || '');
      formData.append('audio_cover_art_url', selectedTrack.cover_art_url || '');
    }

    const endpoint = editingId ? `/api/posts/${editingId}` : '/api/posts';
    const method = editingId ? 'PATCH' : 'POST';
    const body = editingId ? JSON.stringify({ caption: draft.trim(), visibility, filter_preset: filterPreset, status: desiredStatus }) : formData;

    const response = await authedFetch(endpoint, { method, body });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || (editingId ? 'Unable to update post.' : 'Unable to publish post.'));
      return;
    }

    router.push(editingId ? `/post/${editingId}?edited=1` : '/feed?created=1');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitPost('published');
  };

  const goToDetails = () => {
    if (!previewUrl) {
      setError('Upload an image or video before continuing.');
      return;
    }
    setError('');
    setStep('details');
  };

  if (session === undefined) {
    return (
      <main className="min-h-[70vh] px-4 py-6 sm:px-6 lg:px-8">
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
    <main className="min-h-[70vh] px-4 py-6 sm:px-6 lg:px-8">
      <section className={`surface-veil rounded-3xl border border-hairline bg-panel-2/80 p-6 shadow-2xl ${accent.glow} sm:p-8`}>
        <div className={`rounded-[1.6rem] bg-gradient-to-r ${accent.gradient} p-[1px]`}>
          <div className="rounded-[calc(1.6rem-1px)] bg-panel/90 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate">Create</p>
                <h1 className="text-display mt-2 text-3xl text-ivory">Share a new post</h1>
              </div>
              <div className="rounded-full border border-hairline bg-gradient-to-r from-panel to-panel px-3 py-1 text-sm font-semibold text-obsidian">
                {visibility === 'public' ? 'Public' : visibility === 'connections' ? 'Connections only' : 'Private'}
              </div>
            </div>

            <div className="mt-8 grid gap-4 rounded-3xl border border-hairline bg-panel/80 p-4 sm:grid-cols-[1.3fr_0.9fr] sm:p-6">
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-ivory">Step {step === 'media' ? '1' : '2'} of 2</p>
                    <p className="text-xs text-slate">{step === 'media' ? 'Pick your media and prep the preview.' : 'Add caption, visibility, and optional audio.'}</p>
                  </div>
                  <div className="flex gap-2 text-xs uppercase tracking-[0.28em] text-slate">
                    <span className={step === 'media' ? 'text-gold' : 'text-slate'}>Media</span>
                    <span className="text-slate">→</span>
                    <span className={step === 'details' ? 'text-gold' : 'text-slate'}>Details</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="overflow-hidden rounded-[2rem] border border-hairline bg-panel-2/70">
                    <div className="relative aspect-[9/16] min-h-[320px] overflow-hidden bg-panel/70 sm:aspect-[4/5] lg:min-h-[520px]">
                      {previewUrl ? (
                        <div className={`absolute inset-0 ${filterClasses[filterPreset]}`}>
                          {mediaType === 'image' ? (
                            <img src={previewUrl} alt={draft || 'Post preview'} className="h-full w-full object-cover" />
                          ) : (
                            <video controls src={previewUrl} className="h-full w-full object-cover" />
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-panel-2 via-panel to-obsidian p-8 text-center text-slate">
                          <div className="max-w-sm">
                            <p className="text-xs uppercase tracking-[0.32em] text-gold">Media first</p>
                            <p className="mt-3 text-lg font-semibold text-ivory">Drop a photo or video here to publish.</p>
                            <p className="mt-2 text-sm text-slate">The preview stays front and center, while captions, visibility, and audio live below.</p>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-x-0 top-4 flex items-center justify-between px-4 sm:px-6">
                        <div className="rounded-full border border-hairline bg-obsidian/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-ivory">
                          {visibility === 'public' ? 'Public' : visibility === 'connections' ? 'Connections' : 'Private'}
                        </div>
                        <div className="flex gap-2">
                          {previewUrl ? (
                            <>
                              <button type="button" onClick={removeMedia} className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-100">Remove</button>
                              <button type="button" onClick={openFilePicker} className="rounded-full bg-ivory/10 px-2.5 py-1 text-xs font-semibold text-ivory">Replace</button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/95 via-obsidian/65 to-transparent px-4 py-4 sm:px-6">
                        <label onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-hairline bg-panel/50 px-4 py-3 text-sm text-slate transition hover:bg-panel-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            className="sr-only"
                            onChange={(event) => handleMediaChange(event.target.files?.[0] ?? null)}
                          />
                          {previewUrl ? 'Tap to change media' : 'Drop a photo or video or tap to choose'}
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.32em] text-slate">Filters</p>
                          <p className="mt-1 text-sm text-slate">Choose a preset to tone the preview before publishing.</p>
                        </div>
                        <div className="rounded-full border border-hairline bg-ivory/5 px-3 py-1 text-xs uppercase tracking-[0.26em] text-slate">
                          {mediaType === 'image' ? 'Image' : 'Video'}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {FILTER_PRESETS.map((preset) => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setFilterPreset(preset.key)}
                            className={`rounded-full border px-3 py-2 text-left text-sm ${filterPreset === preset.key ? 'border-amber-400 bg-gold/10 text-ivory' : 'border-hairline text-slate hover:border-white/20 hover:bg-ivory/5'}`}
                          >
                            <span className="font-semibold">{preset.label}</span>
                          </button>
                        ))}
                      </div>

                      {step === 'details' ? (
                        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate">Caption</label>
                            <textarea
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              maxLength={280}
                              placeholder="What are you sharing today?"
                              className="min-h-[120px] w-full rounded-2xl border border-hairline bg-panel-2 px-4 py-3 text-sm text-ivory outline-none"
                            />
                            <div className="mt-2 flex items-center justify-between text-xs text-slate">
                              <span>Keep it concise and intimate.</span>
                              <span>{characterCount}/280</span>
                            </div>
                          </div>

                          <div className="space-y-4 rounded-2xl border border-hairline bg-panel/60 p-4">
                            <div className="rounded-2xl border border-hairline bg-gradient-to-r from-obsidian to-panel p-[1px]">
                              <div className="rounded-[calc(1.2rem-1px)] bg-panel/90 p-4 text-sm text-slate">
                                <p className="font-semibold text-ivory">Visibility</p>
                                <select
                                  value={visibility}
                                  onChange={(event) => setVisibility(event.target.value as 'public' | 'connections' | 'private')}
                                  className="mt-3 w-full rounded-xl border border-hairline bg-panel px-3 py-2 text-sm text-ivory outline-none"
                                >
                                  <option value="public">Public</option>
                                  <option value="connections">Connections only</option>
                                  <option value="private">Private</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate">Audio search</label>
                              <input
                                value={trackQuery}
                                onChange={(event) => {
                                  setTrackQuery(event.target.value);
                                  setSelectedTrack(null);
                                }}
                                placeholder="Search for a track to attach"
                                className="mt-3 w-full rounded-xl border border-hairline bg-panel px-4 py-3 text-sm text-ivory outline-none"
                              />

                              {trackResults.length > 0 ? (
                                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
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
                                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-panel/90 p-4 text-sm text-ivory">
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
                                    <div className="mt-4">
                                      <audio ref={audioRef} src={selectedTrack.preview_url} className="w-full" controls />
                                      <div className="mt-2 flex items-center gap-2">
                                        <input
                                          type="range"
                                          min={0}
                                          max={audioDuration || 0}
                                          step={0.01}
                                          value={audioTime}
                                          onChange={(event) => {
                                            const nextTime = Number(event.target.value);
                                            if (audioRef.current) {
                                              audioRef.current.currentTime = nextTime;
                                            }
                                            setAudioTime(nextTime);
                                          }}
                                          className="w-full"
                                        />
                                        <div className="text-xs text-slate">{new Date(audioTime * 1000).toISOString().substr(14, 5)}</div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-4 text-xs text-slate">No preview available for this track.</p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-hairline bg-panel/70 p-5 text-sm text-slate">
                          <p className="font-semibold text-ivory">Ready for the next step</p>
                          <p className="mt-2">Once your media is selected, continue to add caption, visibility, and optional audio.</p>
                        </div>
                      )}

                      {error ? (
                        <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate">Posting uses the same upload logic as the feed composer.</p>
                        {step === 'details' ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void submitPost('draft')}
                              className="rounded-full border border-hairline bg-panel px-5 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/10"
                            >
                              Save draft
                            </button>
                            <button
                              type="submit"
                              className={`rounded-full bg-gradient-to-r ${accent.gradient} px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                              disabled={busy}
                            >
                              {busy ? 'Publishing…' : editingId ? 'Update post' : 'Publish post'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={goToDetails}
                            className="rounded-full bg-gradient-to-r from-gold to-gold-deep px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110"
                          >
                            Continue to details
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
