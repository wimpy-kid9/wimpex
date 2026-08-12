"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { authedFetch } from '@/lib/api-client';

const FILTER_CLASSES: Record<string, string> = {
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

export default function PostCard({ post }: { post: any }) {
  const [liked, setLiked] = useState<boolean>(post?.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState<number | null>(post?.like_count ?? null);
  const [favorited, setFavorited] = useState<boolean>(post?.favorited_by_me ?? false);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(post?.favorite_count ?? null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const init = async () => {
      // Optionally load post-specific state here later.
    };

    void init();
  }, [post?.author_id]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current;
        if (!video) return;
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const toggleLike = async () => {
    const prevLiked = liked;
    const prevCount = likeCount ?? 0;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    const resp = await authedFetch(`/api/posts/${post.id}/like`, { method: 'POST' });
    if (!resp.ok) {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      return;
    }
    const json = await resp.json();
    setLiked(json.liked);
    setLikeCount(json.count ?? prevCount);
  };

  const toggleFavorite = async () => {
    const prevFav = favorited;
    const prevCount = favoriteCount ?? 0;
    setFavorited(!prevFav);
    setFavoriteCount(prevFav ? Math.max(0, prevCount - 1) : prevCount + 1);

    const resp = await authedFetch(`/api/posts/${post.id}/favorite`, { method: 'POST' });
    if (!resp.ok) {
      setFavorited(prevFav);
      setFavoriteCount(prevCount);
      return;
    }
    const json = await resp.json();
    setFavorited(json.favorited);
    setFavoriteCount(json.count ?? prevCount);
  };

  // follow/unfollow handled elsewhere; keep follower state updated but remove unused toggle

  const loadComments = async () => {
    const resp = await authedFetch(`/api/posts/${post.id}/comments`);
    const json = await resp.json();
    setComments(json.comments || []);
  };

  const postComment = async () => {
    if (!commentBody.trim()) return;
    const payload = { body: commentBody.trim() } as any;
    if (replyTo?.id) payload.parent_comment_id = replyTo.id;
    const resp = await authedFetch(`/api/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify(payload) });
    const json = await resp.json();
    if (resp.ok && json.comment) {
      setComments((c) => (c ? [...(replyTo ? [json.comment, ...c] : [json.comment, ...c])] : [json.comment]));
      setCommentBody('');
      setReplyTo(null);
    }
  };

  const postLink = `/user/${post.author_id}`;
  const topText = post.author || post.handle || 'WIMPEX user';
  const caption = post.caption || '';
  const overlayFilter = FILTER_CLASSES[post.filterPreset || 'none'] || '';

  return (
    <article ref={cardRef} className="h-[100dvh] w-full relative overflow-hidden bg-black text-ivory">
      {post.mediaType === 'image' && post.imageUrl ? (
        <img src={post.imageUrl} alt={post.caption || 'Post image'} className={`absolute inset-0 h-full w-full object-cover ${overlayFilter}`} />
      ) : post.mediaType === 'video' && post.videoUrl ? (
        <video
          ref={videoRef}
          src={post.videoUrl}
          muted={muted}
          playsInline
          loop
          className={`absolute inset-0 h-full w-full object-cover ${overlayFilter}`}
          onClick={() => setMuted(false)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-panel-900 text-slate">No media available.</div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute left-3 top-3 flex items-center gap-3 rounded-3xl bg-black/60 px-3 py-2 backdrop-blur-sm">
        <Link href={postLink} className="flex items-center gap-3">
          {post.avatar_url ? (
            <img src={post.avatar_url} alt={post.author || post.handle || 'Author avatar'} className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-full bg-panel-2 text-base text-slate">{(post.author || post.handle || 'W').charAt(0).toUpperCase()}</div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ivory">{topText}</p>
            <p className="text-xs text-slate">{post.handle || '@wimpex'}</p>
          </div>
        </Link>
      </div>

      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-slate">
        <Link href={postLink} className="rounded-full border border-white/10 bg-black/70 p-1 transition hover:scale-105">
          {post.avatar_url ? (
            <img src={post.avatar_url} alt={post.author || post.handle || 'Author avatar'} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-panel-2 text-sm text-slate">{(post.author || post.handle || 'W').charAt(0).toUpperCase()}</div>
          )}
        </Link>

        <button type="button" onClick={toggleLike} className="flex flex-col items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-center transition hover:bg-black/80">
          <span className="text-lg">❤️</span>
          <span className="text-xs font-semibold text-ivory">{likeCount ?? 0}</span>
        </button>

        <button type="button" onClick={() => { setShowComments(true); if (!comments) void loadComments(); }} className="flex flex-col items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-center transition hover:bg-black/80">
          <span className="text-lg">💬</span>
          <span className="text-xs font-semibold text-ivory">{comments?.length ?? 0}</span>
        </button>

        <button type="button" onClick={toggleFavorite} className="flex flex-col items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-center transition hover:bg-black/80">
          <span className="text-lg">📌</span>
          <span className="text-xs font-semibold text-ivory">{favoriteCount ?? 0}</span>
        </button>
      </div>

      <div className="absolute left-3 bottom-6 max-w-[75%] space-y-3 text-sm leading-6">
        <Link href={postLink} className="inline-flex items-center gap-2 text-sm font-semibold text-ivory transition hover:text-gold">
          <span>@{post.handle?.replace(/^@/, '') || 'wimpex'}</span>
        </Link>
        <p className="line-clamp-2 text-ivory/90">{caption || 'No caption yet.'}</p>
        {post.audioTrackName ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs text-slate backdrop-blur-sm">
            <span>🎵</span>
            <span>{post.audioTrackName}{post.audioArtistName ? ` — ${post.audioArtistName}` : ''}</span>
          </div>
        ) : null}
      </div>

      {showComments ? (
        <div className="absolute inset-x-3 bottom-3 max-h-[55%] overflow-hidden rounded-3xl border border-hairline bg-panel/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ivory">Comments</p>
              <p className="text-xs text-slate">Tap a reply to respond inline.</p>
            </div>
            <button onClick={() => setShowComments(false)} className="text-sm text-slate transition hover:text-ivory">Close</button>
          </div>
          <div className="max-h-[260px] overflow-y-auto px-4 py-3 space-y-3">
            {comments && comments.length > 0 ? (
              comments.map((c) => (
                <div key={c.id} className="rounded-3xl border border-hairline bg-panel-90 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ivory">{c.author || c.author_handle || 'User'}</p>
                      <p className="text-xs text-slate">{new Date(c.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setReplyTo(c)} className="text-xs text-gold transition hover:text-amber-100">Reply</button>
                  </div>
                  <p className="mt-2 text-sm text-slate">{c.body}</p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-hairline bg-panel-80 p-4 text-center text-sm text-slate">No comments yet.</div>
            )}
          </div>
          <div className="border-t border-hairline px-4 py-4">
            {replyTo ? (
              <div className="mb-3 rounded-2xl bg-panel/80 px-3 py-2 text-xs text-slate">
                Replying to <span className="font-semibold text-ivory">{replyTo.author || replyTo.author_handle || 'that comment'}</span>
                <button onClick={() => setReplyTo(null)} className="ml-2 text-gold">Cancel</button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment"
                className="min-h-[80px] flex-1 rounded-3xl border border-hairline bg-panel px-3 py-2 text-sm text-ivory outline-none"
              />
              <button onClick={postComment} className="rounded-3xl bg-gold px-4 py-3 text-sm font-semibold text-obsidian">Post</button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
