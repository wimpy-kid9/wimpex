"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PostCard from '@/app/components/PostCard';

export default function PostDetailClient({ post }: { post: any }) {
  const search = useSearchParams();
  const edited = search?.get('edited') === '1';
  const [showToast, setShowToast] = useState<boolean>(edited);

  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  return (
    <div className="space-y-6">
      {showToast ? (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gold/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg">
          Post updated
        </div>
      ) : null}

      <PostCard post={post} />
    </div>
  );
}
