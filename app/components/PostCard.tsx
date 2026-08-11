"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';
import { getUserAccent } from '@/lib/ui-theme';

const FILTER_CLASSES: Record<string, string> = {
  none: '',
  vivid: 'filter saturate-150 contrast-110',
  mono: 'filter grayscale contrast-110',
  warm: 'filter sepia contrast-105 saturate-110',
  cool: 'filter hue-rotate-190 saturate-120 contrast-105',
  neon: 'filter saturate-200 drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]'
};

export default function PostCard({ post }: { post: any }) {
  const [liked, setLiked] = useState<boolean>(post?.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState<number | null>(post?.like_count ?? null);
  const [favorited, setFavorited] = useState<boolean>(post?.favorited_by_me ?? false);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(post?.favorite_count ?? null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [commentBody, setCommentBody] = useState('');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(post?.follower_count ?? null);

  const accent = getUserAccent(post.author || post.handle || 'wimpex-post');
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      try {
        const meResp = await authedFetch('/api/profile');
        let meId = null;
        if (meResp.ok) {
          const p = await meResp.json();
          meId = p.profile?.user_id ?? null;
          setCurrentUserId(meId);
        }

        if (post?.author_id) {
          const fResp = await authedFetch(`/api/follow?user_id=${post.author_id}&type=followers`);
          if (fResp.ok) {
            const j = await fResp.json();
            const followers = j.followers || [];
            if (followers.length > 0 && typeof followers[0] === 'object') {
              setFollowerCount(followers.length);
              setFollowing(meId ? followers.some((f: any) => f.user_id === meId) : false);
            } else {
              setFollowerCount(followers.length);
              setFollowing(meId ? followers.includes(meId) : false);
            }
          } else {
            setFollowing(false);
          }
        }
      } catch (err) {
        // ignore
      }
    };
    void init();
  }, [post?.author_id]);

  const toggleLike = async () => {
    const prevLiked = liked;
    const prevCount = likeCount ?? 0;
    // optimistic
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    const resp = await authedFetch(`/api/posts/${post.id}/like`, { method: 'POST' });
    if (!resp.ok) {
      // rollback
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

  const toggleFollow = async () => {
    if (!post?.author_id) return;
    if (currentUserId && post.author_id === currentUserId) return; // can't follow self
    const prev = following;
    const prevCount = followerCount ?? 0;
    setFollowing(!prev);
    setFollowerCount(prev ? Math.max(0, prevCount - 1) : prevCount + 1);

    const resp = await authedFetch('/api/follow', { method: 'POST', body: JSON.stringify({ followed_id: post.author_id }) });
    if (!resp.ok) {
      // rollback
      setFollowing(prev);
      setFollowerCount(prevCount);
      return;
    }
    const json = await resp.json();
    setFollowing(json.following);
  };

  const loadComments = async () => {
    const resp = await authedFetch(`/api/posts/${post.id}/comments`);
    const json = await resp.json();
    setComments(json.comments || []);
  };

  const postComment = async () => {
    if (!commentBody.trim()) return;
    const resp = await authedFetch(`/api/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ body: commentBody.trim() }) });
    const json = await resp.json();
    if (resp.ok && json.comment) {
      setComments((c) => (c ? [json.comment, ...c] : [json.comment]));
      setCommentBody('');
    }
  };

  return (
    <article className="feed-snap-item thread-card surface-veil rounded-md bg-panel-2/80 p-5 shadow-lg shadow-black/20 backdrop-blur-xl min-h-[78vh] md:min-h-0">
      <div className={`rounded-md bg-gradient-to-r ${accent.gradient} p-[1px]`}>
        <div className="rounded-md bg-panel/90 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              {post.avatar_url ? (
                <img src={post.avatar_url} alt={post.author || post.handle || 'Author avatar'} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full bg-panel-2 text-sm font-semibold text-slate">
                  {post.author?.charAt(0).toUpperCase() || post.handle?.charAt(1)?.toUpperCase() || 'W'}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-ivory">{post.author}</p>
                <p className="text-sm text-slate">{post.handle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {followerCount !== null ? <div className="text-sm text-slate">{followerCount} followers</div> : null}
              {currentUserId && post.author_id !== currentUserId ? (
                <button onClick={toggleFollow} className={`rounded-full px-3 py-1 text-xs font-semibold ${following ? 'bg-ivory/5 text-ivory' : 'bg-gold/20 text-gold'}`}>
                  {following ? 'Following' : 'Follow'}
                </button>
              ) : null}
              <span className="thread-pill rounded-full border border-hairline px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate">{post.visibility}</span>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-panel-2/70">
            {post.mediaType === 'image' && post.imageUrl ? (
              <img src={post.imageUrl} alt={post.caption || 'Post image'} className={`h-[56vh] w-full object-cover md:h-56 ${FILTER_CLASSES[post.filterPreset || 'none'] || ''}`} />
            ) : post.mediaType === 'video' && post.videoUrl ? (
              <video controls src={post.videoUrl} className={`h-[56vh] w-full object-cover md:h-56 ${FILTER_CLASSES[post.filterPreset || 'none'] || ''}`} />
            ) : (
              <div className="flex h-[56vh] items-center justify-center bg-panel/70 text-slate md:h-56">No media attached.</div>
            )}
          </div>
          <p className="mt-4 text-sm leading-7 text-slate">{post.caption}</p>
          {post.filterPreset && post.filterPreset !== 'none' ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-hairline bg-ivory/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate">
              Filter: {post.filterPreset}
            </div>
          ) : null}
          {post.audioTrackName ? (
            <div className="mt-4 rounded-md border border-hairline bg-panel/80 p-4 text-sm text-ivory">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  {post.audioCoverArtUrl ? (
                    <img src={post.audioCoverArtUrl} alt={post.audioTrackName} className="h-16 w-16 rounded-3xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-panel-2 text-xs uppercase tracking-[0.3em] text-slate">Audio</div>
                  )}
                  <div>
                    <p className="font-semibold text-ivory">{post.audioTrackName}</p>
                    <p className="text-sm text-slate">{post.audioArtistName}</p>
                  </div>
                </div>
                {post.audioPreviewUrl ? (
                  <audio controls src={post.audioPreviewUrl} className="w-full md:w-auto" />
                ) : (
                  <p className="text-xs text-slate">Preview not available</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <button onClick={toggleLike} className={`rounded-xl px-3 py-2 ${liked ? 'bg-gold/20 text-gold' : 'bg-ivory/5 text-ivory'}`}>{liked ? 'Liked' : 'Like'}{likeCount !== null ? ` (${likeCount})` : ''}</button>
            <button onClick={toggleFavorite} className={`rounded-xl px-3 py-2 ${favorited ? 'bg-gold/20 text-gold' : 'bg-ivory/5 text-ivory'}`}>{favorited ? 'Saved' : 'Save'}{favoriteCount !== null ? ` (${favoriteCount})` : ''}</button>
            <button onClick={() => { setShowComments((s) => !s); if (!comments) void loadComments(); }} className="rounded-xl px-3 py-2 bg-ivory/5 text-ivory">Comments{comments ? ` (${comments.length})` : ''}</button>
            <button onClick={async () => { await authedFetch(`/api/posts/${post.id}/share`, { method: 'POST' }); }} className="rounded-xl px-3 py-2 bg-ivory/5 text-ivory">Share</button>
            {currentUserId && post.author_id === currentUserId ? (
              <button onClick={() => router.push(`/post?edit=${post.id}`)} className="rounded-xl px-3 py-2 bg-ivory/5 text-ivory">Edit</button>
            ) : null}
          </div>

          {showComments ? (
            <div className="mt-4">
              <div className="space-y-2">
                <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} className="w-full rounded-2xl bg-panel px-3 py-2 text-sm text-ivory" placeholder="Write a comment" />
                <div className="flex gap-2">
                  <button onClick={postComment} className="rounded-2xl bg-gradient-to-r from-gold to-gold-deep px-3 py-2 text-sm font-semibold text-obsidian">Post</button>
                  <button onClick={() => setShowComments(false)} className="rounded-2xl border border-hairline px-3 py-2 text-sm text-ivory">Close</button>
                </div>
              </div>
              {comments && comments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-xl border border-hairline bg-panel/70 p-3 text-sm text-ivory">
                      <p className="font-medium text-ivory">{c.author_id}</p>
                      <p className="mt-1 text-slate">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
