'use client';

import { useEffect } from 'react';
import { authedFetch } from '@/lib/api-client';

export default function ProfileViewTracker({ profileUserId }: { profileUserId: string }) {
  useEffect(() => {
    if (profileUserId) void authedFetch('/api/profile/views', { method: 'POST', body: JSON.stringify({ profileUserId }) });
  }, [profileUserId]);
  return null;
}
