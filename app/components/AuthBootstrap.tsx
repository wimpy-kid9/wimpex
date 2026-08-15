"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
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
    // After setSession succeeds (from either the web hash flow or the
    // native deep-link callback), check onboarding status the same way
    // in both cases.
    const checkOnboarding = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session || pathname === '/onboarding') return;

      const profileResponse = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (!profileData?.profile || profileData?.profile?.onboarding_completed_at === null) {
          router.replace('/onboarding');
        }
      }
    };

    const initAuth = async () => {
      if (typeof window === 'undefined') return;

      const { access_token, refresh_token } = parseHash(window.location.hash);

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      await checkOnboarding();
    };

    initAuth();

    // Native-only: WimpyID's final redirect after login comes back as
    // com.wimpex.app://auth-callback#access_token=...&refresh_token=...
    // This event fires when Android hands that URL to the app.
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
      try {
        const url = new URL(event.url);
        const { access_token, refresh_token } = parseHash(url.hash);
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          await checkOnboarding();
        }
      } catch (err) {
        console.error('Failed to handle auth deep link', err);
      }
    });

    return () => {
      listenerPromise.then(listener => listener.remove());
    };
  }, [pathname, router]);

  return null;
}