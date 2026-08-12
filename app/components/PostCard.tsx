"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function PostCard({ post, isFeedItem }: { post: any; isFeedItem?: boolean }) {
  const [liked, setLiked] = useState<boolean>(post?.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState<number | null>(post?.like_count ?? null);
  const [favorited, setFavorited] = useState<boolean>(post?.favorited_by_me ?? false);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(post?.favorite_count ?? null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [repliesOpen, setRepliesOpen] = useState<Record<string, boolean>>({});
  // Default to unmuted per UX request
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);

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
    <article ref={cardRef} className={`w-full relative overflow-hidden bg-black text-ivory ${isFeedItem ? 'feed-snap-item h-[100dvh] md:h-[80vh]' : ''}`}>
      {post.mediaType === 'image' && post.imageUrl ? (
        <img src={post.imageUrl} alt={post.caption || 'Post image'} className={`absolute inset-0 h-full w-full object-cover md:object-contain ${overlayFilter}`} />
      ) : post.mediaType === 'video' && post.videoUrl ? (
        <video
          ref={videoRef}
          src={post.videoUrl}
          muted={muted}
          playsInline
          loop
            className={`absolute inset-0 h-full w-full object-cover md:object-contain ${overlayFilter}`}
            onClick={async () => {
              try {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) {
                  await v.play().catch(() => undefined);
                } else {
                  v.pause();
                }
              } catch (e) {
                // ignore
              }
            }}
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

      {/* Unmute / play control */}
      {post.mediaType === 'video' && post.videoUrl ? (
        <div className="absolute right-4 bottom-40">
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const v = videoRef.current;
              if (!v) return;
              if (muted) {
                v.muted = false;
                setMuted(false);
                await v.play().catch(() => undefined);
              } else {
                v.muted = true;
                setMuted(true);
              }
            }}
            className={`rounded-full px-3 py-2 text-lg font-semibold text-ivory transition-transform focus:outline-none focus:ring-2 focus:ring-gold/40 ${muted ? 'bg-black/60 border border-white/10 hover:scale-105' : 'bg-gradient-to-r from-gold to-gold-deep shadow-lg transform hover:scale-105 ring-2 ring-gold/30'}`}
            aria-pressed={!muted}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <span className="inline-block" aria-hidden>
              {muted ? '🔈' : '🔊'}
            </span>
          </button>
        </div>
      ) : null}

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
                            <p className="mt-3 text-sm text-slate">{c.body}</p>
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
                                  <p className="mt-3 text-sm text-slate">{reply.body}</p>
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
  );
}
