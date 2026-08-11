"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserAccent } from '@/lib/ui-theme';
import { authedFetch } from '@/lib/api-client';

export default function CreatePostPage() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'private'>('public');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [session, setSession] = useState<any>(null);
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
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, [editingId]);

  useEffect(() => {
    if (!videoFile) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(videoFile);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [videoFile]);

  const accent = useMemo(() => getUserAccent(session?.user?.id ?? 'post-creator'), [session?.user?.id]);
  const characterCount = draft.length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() && !videoFile) {
      setError('Add a caption or a video before publishing.');
      return;
    }

    setBusy(true);
    setError('');

    if (editingId) {
      const response = await authedFetch(`/api/posts/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption: draft.trim(), visibility })
      });
      setBusy(false);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || 'Unable to update post.');
        return;
      }
      // redirect to the post detail page and show a confirmation toast
      router.push(`/post/${editingId}?edited=1`);
      return;
    }

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const formData = new FormData();
    if (videoFile) {
      formData.append('video', videoFile);
    }
    formData.append('caption', draft.trim());
    formData.append('visibility', visibility);

    const response = await authedFetch('/api/posts', {
      method: 'POST',
      headers,
      body: formData
    });

    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || 'Unable to publish post.');
      return;
    }

    // redirect to feed and show confirmation toast
    router.push('/feed?created=1');
  };

  return (
    <main className="min-h-[70vh] px-2 py-4 sm:px-6 lg:px-8">
      <section className={`surface-veil rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl ${accent.glow} sm:p-8`}>
        <div className={`rounded-[1.6rem] bg-gradient-to-r ${accent.gradient} p-[1px]`}>
          <div className="rounded-[calc(1.6rem-1px)] bg-slate-950/90 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Create</p>
                <h1 className="text-display mt-2 text-3xl text-white">Share a new post</h1>
              </div>
              <div className={`rounded-full border border-white/10 bg-gradient-to-r ${accent.gradient} px-3 py-1 text-sm font-semibold text-slate-950`}>
                {visibility === 'public' ? 'Public' : visibility === 'connections' ? 'Connections only' : 'Private'}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Caption</label>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={280}
                  placeholder="What are you sharing today?"
                  className="min-h-[120px] w-full rounded-[1.4rem] border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Keep it concise and intimate.</span>
                  <span>{characterCount}/280</span>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.4rem] border border-white/10 bg-slate-900/70 p-4">
                  <label className="block text-sm font-medium text-slate-300">Video upload</label>
                  <label className="mt-3 flex cursor-pointer items-center justify-center rounded-[1.2rem] border border-dashed border-white/10 bg-slate-950/70 px-4 py-6 text-sm text-slate-300 transition hover:bg-slate-800">
                    <input type="file" accept="video/*" className="sr-only" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />
                    {videoFile ? `Selected: ${videoFile.name}` : 'Drop a video or tap to choose'}
                  </label>

                  {previewUrl ? (
                    <video src={previewUrl} controls className="mt-4 h-56 w-full rounded-[1.2rem] object-cover" />
                  ) : (
                    <div className="mt-4 flex h-56 items-center justify-center rounded-[1.2rem] border border-white/10 bg-slate-950/60 text-sm text-slate-400">
                      Your video preview will appear here.
                    </div>
                  )}
                </div>

                <div className="rounded-[1.4rem] border border-white/10 bg-slate-900/70 p-4">
                  <label className="block text-sm font-medium text-slate-300">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as 'public' | 'connections' | 'private')}
                    className="mt-3 w-full rounded-[1.1rem] border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="connections">Connections only</option>
                    <option value="private">Private</option>
                  </select>

                  <div className={`mt-6 rounded-[1.2rem] border border-white/10 bg-gradient-to-r ${accent.gradient} p-[1px]`}>
                    <div className="rounded-[calc(1.2rem-1px)] bg-slate-950/90 p-4 text-sm text-slate-300">
                      <p className="font-semibold text-white">Post intent</p>
                      <p className="mt-2 text-slate-400">The feed stays for viewing; this screen is the dedicated create surface for the next clip or moment.</p>
                    </div>
                  </div>
                </div>
              </div>

              {error ? <p className="rounded-[1.1rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">Posting uses the same upload logic as the feed composer.</p>
                <button
                  type="submit"
                  className={`rounded-[1.1rem] bg-gradient-to-r ${accent.gradient} px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={busy}
                >
                  {busy ? 'Publishing…' : 'Publish post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
