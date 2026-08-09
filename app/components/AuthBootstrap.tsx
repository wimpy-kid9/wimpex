"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const parseHash = (hash: string) => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token')
  };
};

export default function AuthBootstrap() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      if (typeof window === 'undefined') return;

      const { access_token, refresh_token } = parseHash(window.location.hash);

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session) {
        return;
      }

      if (pathname === '/onboarding') {
        return;
      }

      const profileResponse = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (!profileData?.profile || profileData?.profile?.onboarding_completed_at === null) {
          router.replace('/onboarding');
        }
      }
    };

    initAuth();
  }, [pathname, router]);

  return null;
}
