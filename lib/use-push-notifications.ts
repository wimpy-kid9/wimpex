import { useEffect, useState, useCallback } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');

  // Check current permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.error('Push notifications not supported in this browser');
      return;
    }

    if (Notification.permission === 'denied') {
      console.warn('Push notification permission denied by user');
      return;
    }

    setSubscriptionStatus('subscribing');

    try {
      const registration = await navigator.serviceWorker.ready;

      // Request notification permission if not already granted
      let permissionGranted = Notification.permission;
      if (permissionGranted === 'default') {
        permissionGranted = await Notification.requestPermission();
      }

      if (permissionGranted !== 'granted') {
        setSubscriptionStatus('error');
        console.warn('Notification permission not granted');
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        setSubscriptionStatus('error');
        return;
      }

      // Convert VAPID key from base64 to Uint8Array
      const vapidArray = new Uint8Array(
        atob(vapidPublicKey)
          .split('')
          .map((char) => char.charCodeAt(0))
      );

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidArray
      });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: btoa(
            String.fromCharCode.apply(
              null,
              Array.from(new Uint8Array(subscription.getKey('p256dh') || []))
            )
          ),
          auth: btoa(
            String.fromCharCode.apply(
              null,
              Array.from(new Uint8Array(subscription.getKey('auth') || []))
            )
          )
        })
      });

      if (response.ok) {
        setSubscriptionStatus('subscribed');
        setPermission('granted');
      } else {
        setSubscriptionStatus('error');
        console.error('Failed to subscribe to push notifications');
      }
    } catch (error) {
      console.error('Push notification subscription error:', error);
      setSubscriptionStatus('error');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Notify server of unsubscription
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        });

        // Unsubscribe locally
        await subscription.unsubscribe();
        setSubscriptionStatus('idle');
        setPermission('default');
      }
    } catch (error) {
      console.error('Push notification unsubscription error:', error);
    }
  }, []);

  return {
    permission,
    subscriptionStatus,
    subscribe,
    unsubscribe
  };
}
