"use client";

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Registers this device for native push (FCM on Android, APNs on iOS via
// FCM) so notifications can be delivered even when the app isn't open or
// isn't in the foreground — something the existing web-push/service-worker
// setup can't reliably do inside a wrapped WebView. Web (non-native) users
// keep using the existing web-push flow in use-push-notifications.ts;
// this component is a no-op there.
export default function NativePushBootstrap() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const sendTokenToServer = async (token: string) => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) return; // not logged in yet — register() will fire again after login

      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

      try {
        await fetch('/api/push/register-device', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ token, platform })
        });
      } catch (err) {
        console.error('Failed to register device push token', err);
      }
    };

    const setup = async () => {
      let permission = await PushNotifications.checkPermissions();

      if (permission.receive === 'prompt') {
        permission = await PushNotifications.requestPermissions();
      }

      if (permission.receive !== 'granted') {
        console.warn('Push notification permission not granted');
        return;
      }

      const localPermission = await LocalNotifications.checkPermissions();
      if (localPermission.display === 'prompt') {
        await LocalNotifications.requestPermissions();
      }

      await LocalNotifications.createChannel({
        id: 'wimpex-calls',
        name: 'Calls',
        description: 'Incoming and missed calls',
        importance: 5,
        sound: 'default',
        vibration: true
      });
      await LocalNotifications.createChannel({
        id: 'wimpex-messages',
        name: 'Messages',
        description: 'New direct and group messages',
        importance: 4,
        sound: 'default',
        vibration: true
      });

      if (cancelled) return;
      // Safe to call again on every sign-in: it just re-delivers the
      // current token to the 'registration' listener below, which is how
      // we catch the case where the device registered before the user
      // was logged in (sendTokenToServer would have bailed out that time).
      await PushNotifications.register();
    };

    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      sendTokenToServer(token.value);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_IN') setup();
    });

    const registrationErrorListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error', err);
    });

    // Foreground: app is open when the notification arrives. There's no
    // system tray banner by default in this case, so surface something
    // simple ourselves — swap this for a toast/in-app banner if you have one.
    const receivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        const data = notification.data || {};
        const isCall = data.type === 'incoming_call';
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Date.now() % 2147483647),
            title: notification.title || (isCall ? 'Incoming call' : 'New notification'),
            body: notification.body || '',
            channelId: isCall ? 'wimpex-calls' : 'wimpex-messages',
            sound: 'default',
            extra: data
          }]
        });
      }
    );

    // User tapped a notification (app was backgrounded/closed). Navigate
    // to wherever it points, if it carries a url.
    const actionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        const url = action.notification?.data?.url;
        if (url) router.push(url);
      }
    );

    setup();

    return () => {
      cancelled = true;
      registrationListener.then((l) => l.remove());
      registrationErrorListener.then((l) => l.remove());
      receivedListener.then((l) => l.remove());
      actionListener.then((l) => l.remove());
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
