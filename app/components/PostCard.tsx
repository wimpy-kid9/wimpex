"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/api-client';
import { getUserAccent } from '@/lib/ui-theme';

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
            setFollowerCount(followers.length);
            setFollowing(meId ? followers.includes(meId) : false);
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
    <article className="feed-snap-item thread-card surface-veil rounded-[2rem] bg-slate-900/80 p-5 shadow-lg shadow-black/20 backdrop-blur-xl min-h-[78vh] md:min-h-0">
      <div className={`rounded-[1.5rem] bg-gradient-to-r ${accent.gradient} p-[1px]`}>
        <div className="rounded-[1.4rem] bg-slate-950/90 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-white">{post.author}</p>
              <p className="text-sm text-slate-400">{post.handle}</p>
            </div>
            <div className="flex items-center gap-3">
              {followerCount !== null ? <div className="text-sm text-slate-400">{followerCount} followers</div> : null}
              {currentUserId && post.author_id !== currentUserId ? (
                <button onClick={toggleFollow} className={`rounded-full px-3 py-1 text-xs font-semibold ${following ? 'bg-white/5 text-white' : 'bg-amber-400/20 text-amber-200'}`}>
                  {following ? 'Following' : 'Follow'}
                </button>
              ) : null}
              <span className="thread-pill rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">{post.visibility}</span>
            </div>
          </div>
          {post.videoUrl ? (
            <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900/70">
              <video controls src={post.videoUrl} className="h-[56vh] w-full object-cover md:h-56" />
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-7 text-slate-300">{post.caption}</p>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={toggleLike} className={`rounded-xl px-3 py-2 ${liked ? 'bg-amber-400/20 text-amber-200' : 'bg-white/5 text-slate-200'}`}>{liked ? 'Liked' : 'Like'}{likeCount !== null ? ` (${likeCount})` : ''}</button>
            <button onClick={toggleFavorite} className={`rounded-xl px-3 py-2 ${favorited ? 'bg-amber-400/20 text-amber-200' : 'bg-white/5 text-slate-200'}`}>{favorited ? 'Saved' : 'Save'}{favoriteCount !== null ? ` (${favoriteCount})` : ''}</button>
            <button onClick={() => { setShowComments((s) => !s); if (!comments) void loadComments(); }} className="rounded-xl px-3 py-2 bg-white/5 text-slate-200">Comments{comments ? ` (${comments.length})` : ''}</button>
            <button onClick={async () => { await authedFetch(`/api/posts/${post.id}/share`, { method: 'POST' }); }} className="rounded-xl px-3 py-2 bg-white/5 text-slate-200">Share</button>
            {currentUserId && post.author_id === currentUserId ? (
              <button onClick={() => router.push(`/post?edit=${post.id}`)} className="rounded-xl px-3 py-2 bg-white/5 text-slate-200">Edit</button>
            ) : null}
          </div>

          {showComments ? (
            <div className="mt-4">
              <div className="space-y-2">
                <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} className="w-full rounded-2xl bg-slate-950 px-3 py-2 text-sm text-slate-100" placeholder="Write a comment" />
                <div className="flex gap-2">
                  <button onClick={postComment} className="rounded-2xl bg-gradient-to-r from-amber-400 to-sky-500 px-3 py-2 text-sm font-semibold text-slate-950">Post</button>
                  <button onClick={() => setShowComments(false)} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-200">Close</button>
                </div>
              </div>
              {comments && comments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200">
                      <p className="font-medium text-white">{c.author_id}</p>
                      <p className="mt-1 text-slate-400">{c.body}</p>
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
