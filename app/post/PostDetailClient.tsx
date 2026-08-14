"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PostCard from '@/app/components/PostCard';
import { authedFetch } from '@/lib/api-client';

export default function PostDetailClient({ post }: { post: any }) {
  const search = useSearchParams();
  const router = useRouter();
  const edited = search?.get('edited') === '1';
  const fromCollection = search?.get('from');
  const currentIndex = search?.get('index') ? parseInt(search.get('index')!) : undefined;
  const [showToast, setShowToast] = useState<boolean>(edited);
  const [collectionPosts, setCollectionPosts] = useState<any[]>([]);

  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  // Load collection posts if navigating from liked/favorited collection
  useEffect(() => {
    if (!fromCollection) return;

    const loadCollection = async () => {
      try {
        let url = '/api/posts?type=' + fromCollection;
        if (currentIndex !== undefined) {
          url += `&limit=20&offset=${currentIndex}`;
        }
        const response = await authedFetch(url);
        if (!response.ok) return;
        const data = await response.json();
        setCollectionPosts(data.posts || []);
      } catch (err) {
        console.error('Error loading collection:', err);
      }
    };

    void loadCollection();
  }, [fromCollection, currentIndex]);

  const handlePrevious = () => {
    if (currentIndex === undefined || currentIndex === 0) return;
    const prevIndex = currentIndex - 1;
    const prevPost = collectionPosts[prevIndex] || collectionPosts[currentIndex - 1];
    if (prevPost) {
      router.push(
        `/post/${prevPost.id}?from=${fromCollection}&index=${prevIndex}`
      );
    }
  };

  const handleNext = () => {
    if (currentIndex === undefined) return;
    const nextIndex = currentIndex + 1;
    const nextPost = collectionPosts[nextIndex] || collectionPosts[currentIndex + 1];
    if (nextPost) {
      router.push(
        `/post/${nextPost.id}?from=${fromCollection}&index=${nextIndex}`
      );
    }
  };

  const hasPrevious = currentIndex !== undefined && currentIndex > 0;
  const hasNext = currentIndex !== undefined && collectionPosts.length > currentIndex + 1;

  return (
    <div className="relative h-full w-full">
      {showToast ? (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gold/90 px-4 py-2 text-sm font-semibold text-obsidian shadow-lg">
            Post updated
        </div>
      ) : null}

      <PostCard post={post} isFeedItem={false} />

      {fromCollection && (
        <>
          {/* Navigation Controls */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-6">
            {hasPrevious && (
              <button
                type="button"
                onClick={handlePrevious}
                className="pointer-events-auto rounded-full bg-black/60 p-3 text-2xl transition hover:bg-black/80"
                title="Previous"
              >
                ←
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={handleNext}
                className="pointer-events-auto ml-auto rounded-full bg-black/60 p-3 text-2xl transition hover:bg-black/80"
                title="Next"
              >
                →
              </button>
            )}
          </div>

          {/* Position Indicator */}
          {currentIndex !== undefined && (
            <div className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 px-3 py-2 text-xs text-slate backdrop-blur-sm">
              {currentIndex + 1} / {collectionPosts.length}
            </div>
          )}

          {/* Close Button */}
          <Link
            href={`/profile?tab=${fromCollection}`}
            className="absolute top-6 left-6 z-40 rounded-full bg-black/60 p-3 text-lg transition hover:bg-black/80"
            title="Back to collection"
          >
            ←
          </Link>
        </>
      )}
    </div>
  );
}
