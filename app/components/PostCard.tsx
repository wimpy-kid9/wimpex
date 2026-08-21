"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { authedFetch } from '@/lib/api-client';
import { renderRichText } from '@/lib/rich-text';
import ShareSheet from './ShareSheet';
import GoldBadge from './GoldBadge';

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
    infrared: 'filter hue-rotate-310 saturate-140 contrast-115',
    chrome: 'filter contrast-125 saturate-150 brightness-110',
    velvet: 'filter sepia contrast-125 saturate-125 brightness-90',
    arctic: 'filter grayscale-[35%] hue-rotate-180 saturate-75 contrast-110',
    sunset: 'filter sepia saturate-150 hue-rotate-[-15deg] contrast-110'
};

export default function PostCard({ post, isFeedItem, variant }: { post: any; isFeedItem?: boolean; variant?: 'grid' }) {
  const [liked, setLiked] = useState<boolean>(post?.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState<number | null>(post?.like_count ?? null);
  const [favorited, setFavorited] = useState<boolean>(post?.favorited_by_me ?? false);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(post?.favorite_count ?? null);
  const [shareCount, setShareCount] = useState<number | null>(post?.share_count ?? null);
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [repliesOpen, setRepliesOpen] = useState<Record<string, boolean>>({});
  const [mediaFlash, setMediaFlash] = useState<{ type: 'play' | 'pause'; id: number } | null>(null);
  const [heartBurst, setHeartBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  // Default to unmuted per UX request
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const soundTrackRef = useRef<HTMLAudioElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const hasRecordedViewRef = useRef(false);
  const doubleTapRef = useRef<{ timer: number | null; lastTapAt: number }>({ timer: null, lastTapAt: 0 });

  const commentsById = useMemo(() => {
    const map = new Map<string, any>();
    (comments || []).forEach((comment) => {
      if (comment?.id) {
        map.set(comment.id, comment);
      }
    });
    return map;
  }, [comments]);

  const topLevelComments = useMemo(
    () => (comments || []).filter((comment) => !comment.parent_comment_id),
    [comments]
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, any[]>();
    (comments || []).forEach((comment) => {
      if (comment?.parent_comment_id) {
        const parentId = comment.parent_comment_id as string;
        const existing = map.get(parentId) || [];
        existing.push(comment);
        map.set(parentId, existing);
      }
    });
    return map;
  }, [comments]);

  const findTopLevelComment = (comment: any) => {
    let current = comment;
    while (current?.parent_comment_id) {
      const parent = commentsById.get(current.parent_comment_id);
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  const getCommentReplyTarget = (comment: any) => {
    if (!comment?.id) return null;
    if (!comment.parent_comment_id) return comment;
    return findTopLevelComment(comment) || comment;
  };

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
        const soundTrack = soundTrackRef.current;
        if (entry.isIntersecting) {
          if (video) void video.play().catch(() => undefined);
          // The attached sound only lives in this separate <audio> element
          // for image posts (video posts already have the track mixed into
          // the video file itself). Without this, picking a sound and
          // posting an image never actually played it back.
          if (soundTrack) {
            soundTrack.currentTime = 0;
            void soundTrack.play().catch(() => undefined);
          }

          // Record a "view" once per card the first time it's actually
          // scrolled into the feed. This is what lets the feed exclude
          // clips someone has already scrolled past — without it, the
          // backend has no signal at all and the same posts kept
          // resurfacing every time the app opened.
          if (isFeedItem && post?.id && !hasRecordedViewRef.current) {
            hasRecordedViewRef.current = true;
            void authedFetch('/api/interactions', {
              method: 'POST',
              body: JSON.stringify({ post_id: post.id, interaction_type: 'view' })
            }).catch(() => undefined);
          }
        } else {
          if (video) video.pause();
          if (soundTrack) soundTrack.pause();
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isFeedItem, post?.id]);

  useEffect(() => {
    const handleBackgroundPause = () => {
      const video = videoRef.current;
      if (video && !video.paused) video.pause();
      const soundTrack = soundTrackRef.current;
      if (soundTrack && !soundTrack.paused) soundTrack.pause();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleBackgroundPause();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const appListener = App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (!isActive) handleBackgroundPause();
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void appListener.then((listener) => listener.remove());
    };
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

  const toggleVideoPlayback = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const flashId = Date.now();
      await v.play().catch(() => undefined);
      setMediaFlash({ type: 'play', id: flashId });
      window.setTimeout(() => setMediaFlash((current) => (current?.id === flashId ? null : current)), 420);
    } else {
      const flashId = Date.now();
      v.pause();
      setMediaFlash({ type: 'pause', id: flashId });
      window.setTimeout(() => setMediaFlash((current) => (current?.id === flashId ? null : current)), 420);
    }
  };

  const handleVideoTap = (event: any) => {
    const video = videoRef.current;
    const mediaElement = video || event.currentTarget;
    if (!mediaElement) return;

    const rect = mediaElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = Date.now();

    if (doubleTapRef.current.timer) {
      window.clearTimeout(doubleTapRef.current.timer);
      doubleTapRef.current.timer = null;
    }

    if (now - doubleTapRef.current.lastTapAt < 280) {
      if (!liked) {
        const burstId = Date.now();
        setHeartBurst({ x, y, id: burstId });
        window.setTimeout(() => setHeartBurst((current) => (current?.id === burstId ? null : current)), 650);
        void toggleLike();
      }
      doubleTapRef.current.lastTapAt = 0;
      return;
    }

    doubleTapRef.current.lastTapAt = now;
    doubleTapRef.current.timer = window.setTimeout(() => {
      if (video) void toggleVideoPlayback();
      doubleTapRef.current.lastTapAt = 0;
      doubleTapRef.current.timer = null;
    }, 220);
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
    <>
    <article ref={cardRef} className={`relative w-full overflow-hidden bg-black text-ivory ${variant === 'grid' ? 'aspect-[3/4] rounded-2xl' : ''} ${isFeedItem ? 'feed-snap-item h-[calc(100dvh-var(--header-h)-var(--bottomnav-h))] md:h-[80vh]' : ''}`}>
      {post.mediaType === 'image' && post.imageUrl ? (
        <>
          <img src={post.imageUrl} alt={post.caption || 'Post image'} className={`absolute inset-0 h-full w-full object-contain ${overlayFilter}`} onClick={handleVideoTap} />
          {post.audioPreviewUrl ? (
            <audio ref={soundTrackRef} src={post.audioPreviewUrl} loop muted={muted} />
          ) : null}
        </>
      ) : post.mediaType === 'video' && post.videoUrl ? (
        <video
          ref={videoRef}
          src={post.videoUrl}
          muted={muted}
          playsInline
          loop
          className={`absolute inset-0 h-full w-full object-contain ${overlayFilter}`}
          onClick={handleVideoTap}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-panel-900 text-slate">No media available.</div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className={`absolute left-3 top-3 flex items-center gap-3 rounded-3xl bg-black/60 px-3 py-2 backdrop-blur-sm ${variant === 'grid' ? 'max-w-[calc(100%-1.5rem)] scale-90 origin-top-left' : ''}`}>
        <Link href={postLink} className="flex items-center gap-3">
          {post.avatar_url ? (
            <img src={post.avatar_url} alt={post.author || post.handle || 'Author avatar'} className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-full bg-panel-2 text-base text-slate">{(post.author || post.handle || 'W').charAt(0).toUpperCase()}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-ivory">{topText}</p>
              {post.is_gold ? <GoldBadge size="sm" inline /> : null}
            </div>
            <p className="text-xs text-slate">{post.handle || '@wimpex'}</p>
          </div>
        </Link>
      </div>

      <div className={`absolute right-3 bottom-24 flex flex-col items-center gap-5 text-slate ${variant === 'grid' ? 'bottom-16 gap-2 scale-75 origin-bottom-right' : ''}`}>
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

        <button type="button" onClick={() => setShowShareSheet(true)} className="flex flex-col items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-center transition hover:bg-black/80">
          <span className="text-lg">↗️</span>
          <span className="text-xs font-semibold text-ivory">{shareCount ?? 0}</span>
        </button>

        {/* Unmute / mute control — same column, same width, so it lines up
           with every other icon instead of floating over them. */}
        {(post.mediaType === 'video' && post.videoUrl) || (post.mediaType === 'image' && post.audioPreviewUrl) ? (
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const v = videoRef.current;
              const soundTrack = soundTrackRef.current;
              const target = v || soundTrack;
              if (!target) return;
              if (muted) {
                setMuted(false);
                if (v) v.muted = false;
                if (soundTrack) soundTrack.muted = false;
                await target.play().catch(() => undefined);
              } else {
                setMuted(true);
                if (v) v.muted = true;
                if (soundTrack) soundTrack.muted = true;
              }
            }}
            className={`grid h-11 w-11 place-items-center rounded-full text-lg transition-transform focus:outline-none focus:ring-2 focus:ring-gold/40 ${muted ? 'bg-black/60 border border-white/10 hover:scale-105' : 'bg-gradient-to-r from-gold to-gold-deep shadow-lg transform hover:scale-105 ring-2 ring-gold/30'}`}
            aria-pressed={!muted}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <span aria-hidden>{muted ? '🔈' : '🔊'}</span>
          </button>
        ) : null}
      </div>

      {mediaFlash ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <span className={`text-4xl drop-shadow-lg ${mediaFlash.type === 'play' ? 'text-sky-300' : 'text-amber-200'}`}>
            {mediaFlash.type === 'play' ? '▶' : '⏸'}
          </span>
        </div>
      ) : null}
      {heartBurst ? (
        <div
          className="pointer-events-none absolute z-30 text-4xl drop-shadow-[0_0_18px_rgba(244,114,182,0.8)] animate-pulse"
          style={{ left: `${heartBurst.x}px`, top: `${heartBurst.y}px`, transform: 'translate(-50%, -50%)' }}
        >
          ❤️
        </div>
      ) : null}
      <div className={`absolute left-3 bottom-6 max-w-[75%] space-y-3 text-sm leading-6 ${variant === 'grid' ? 'bottom-3 max-w-[78%] space-y-1 text-xs leading-4' : ''}`}>
        <Link href={postLink} className="inline-flex items-center gap-2 text-sm font-semibold text-ivory transition hover:text-gold">
          <span>@{post.handle?.replace(/^@/, '') || 'wimpex'}</span>
          {post.is_gold ? <GoldBadge size="sm" inline /> : null}
        </Link>
        <p className="line-clamp-2 text-ivory/90">{caption ? renderRichText(caption, { className: 'break-words', linkClassName: 'text-sky-400 underline decoration-sky-400/80 underline-offset-2 hover:text-sky-300' }) : 'No caption yet.'}</p>
        {post.audioTrackName ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs text-slate backdrop-blur-sm">
            <span>🎵</span>
            <span>{post.audioTrackName}{post.audioArtistName ? ` — ${post.audioArtistName}` : ''}</span>
          </div>
        ) : null}
      </div>

      {showComments ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            onClick={() => setShowComments(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-3xl rounded-t-[32px] border border-hairline bg-panel/95 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-slate/40" />
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div>
                <p className="text-sm font-semibold text-ivory">Comments</p>
                <p className="text-xs text-slate">Tap a reply to respond inline.</p>
              </div>
              <button onClick={() => setShowComments(false)} className="text-sm text-slate transition hover:text-ivory">Close</button>
            </div>

            <div className="max-h-[calc(80vh-220px)] overflow-y-auto px-5 pb-4 space-y-4">
              {comments && comments.length > 0 ? (
                topLevelComments.map((c) => {
                  const replies = repliesByParent.get(c.id) || [];
                  return (
                    <div key={c.id} className="space-y-3">
                      <div className="rounded-3xl border border-hairline bg-panel-90 p-4">
                        <div className="flex items-start gap-3">
                          {c.author_avatar_url ? (
                            <img src={c.author_avatar_url} alt={c.author || c.author_handle || 'User avatar'} className="h-11 w-11 rounded-full object-cover" />
                          ) : (
                            <div className="grid h-11 w-11 place-items-center rounded-full bg-panel-2 text-sm text-slate">
                              {(c.author || c.author_handle || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-ivory">{c.author || c.author_handle || 'User'}</p>
                                <p className="mt-1 text-xs text-slate">{new Date(c.created_at).toLocaleString()}</p>
                              </div>
                              <button onClick={() => setReplyTo(getCommentReplyTarget(c))} className="text-xs text-gold transition hover:text-amber-100">Reply</button>
                            </div>
                            <div className="mt-3 text-sm text-slate">{renderRichText(c.body || '', { className: 'break-words', linkClassName: 'text-sky-400 underline decoration-sky-400/80 underline-offset-2 hover:text-sky-300' })}</div>
                          </div>
                        </div>
                        {replies.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setRepliesOpen((open) => ({ ...open, [c.id]: !open[c.id] }))}
                            className="mt-3 text-xs font-medium text-slate transition hover:text-ivory"
                          >
                            {repliesOpen[c.id] ? `Hide ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : `View ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}`}
                          </button>
                        ) : null}
                      </div>
                      {repliesOpen[c.id] ? (
                        <div className="space-y-3 px-4">
                          {replies.map((reply) => (
                            <div key={reply.id} className="rounded-3xl border border-hairline bg-panel-90 p-4 pl-5">
                              <div className="flex items-start gap-3">
                                {reply.author_avatar_url ? (
                                  <img src={reply.author_avatar_url} alt={reply.author || reply.author_handle || 'User avatar'} className="h-9 w-9 rounded-full object-cover" />
                                ) : (
                                  <div className="grid h-9 w-9 place-items-center rounded-full bg-panel-2 text-xs text-slate">
                                    {(reply.author || reply.author_handle || 'U').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-ivory">{reply.author || reply.author_handle || 'User'}</p>
                                      <p className="mt-1 text-xs text-slate">{new Date(reply.created_at).toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => setReplyTo(getCommentReplyTarget(reply))} className="text-xs text-gold transition hover:text-amber-100">Reply</button>
                                  </div>
                                  <div className="mt-3 text-sm text-slate">{renderRichText(reply.body || '', { className: 'break-words', linkClassName: 'text-sky-400 underline decoration-sky-400/80 underline-offset-2 hover:text-sky-300' })}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-hairline bg-panel-80 p-4 text-center text-sm text-slate">No comments yet.</div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-hairline bg-panel/95 px-5 py-4">
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
        </div>
      ) : null}
    </article>

    <ShareSheet
      postId={post.id}
      isOpen={showShareSheet}
      onClose={() => setShowShareSheet(false)}
      onShared={() => setShareCount((c) => (c ?? 0) + 1)}
    />
    </>
  );
}