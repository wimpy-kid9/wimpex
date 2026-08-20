import webpush, { WebPushError } from 'web-push';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase-server';
import { messaging, isFirebaseConfigured } from '@/lib/firebase-admin';

// Configure web-push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@wimpex.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  url?: string;
  channelId?: string;
  sound?: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a user's native (Android/iOS) app instances
 * via Firebase Cloud Messaging. This is what actually reaches the device
 * when the app isn't open — web-push through a wrapped WebView can't do
 * that reliably, which is the whole reason this exists alongside it.
 */
async function sendFcmToUser(userId: string, options: PushNotificationOptions) {
  if (!isFirebaseConfigured || !messaging) {
    return; // Native push not configured yet — silently skip, web-push still runs.
  }

  const { data: devices, error } = await supabaseServer
    .from('wpx_device_push_tokens')
    .select('token')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching device tokens:', error);
    return;
  }

  if (!devices || devices.length === 0) return;

  const results = await Promise.allSettled(
    devices.map((device: any) =>
      messaging!.send({
        token: device.token,
        data: {
          ...(options.data || {}),
          ...(options.url ? { url: options.url } : {}),
          title: options.title,
          body: options.body,
          notificationSound: options.sound || options.data?.notificationSound || 'default'
        },
        android: {
          priority: 'high' as const
        },
        apns: { headers: { 'apns-priority': '10' } }
      })
    )
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const reason = result.reason;
      const code = reason?.errorInfo?.code;
      console.error(`FCM send failed for ${devices[i].token}:`, code || reason?.message || reason);

      // Token no longer valid (uninstalled, app data cleared, etc.) — clean it up.
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        await supabaseServer
          .from('wpx_device_push_tokens')
          .delete()
          .eq('token', devices[i].token)
          .catch((err: unknown) => console.error('Error deleting device token:', err));
      }
    }
  }
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(userId: string, options: PushNotificationOptions) {
  // Native FCM delivery runs independently of web-push/Supabase config so
  // one being unconfigured doesn't block the other.
  await sendFcmToUser(userId, options);

  if (!isSupabaseServerConfigured) {
    console.error('Supabase not configured');
    return;
  }

  try {
    // Get all subscriptions for user
    const { data: subscriptions, error } = await supabaseServer
      .from('wpx_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      title: options.title,
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      tag: options.tag,
      requireInteraction: options.requireInteraction,
      url: options.url,
      data: options.data
    });

    // Send notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        )
      )
    );

    // Log results and remove failed subscriptions
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const reason = result.reason;

        // web-push throws a WebPushError with a real `statusCode` property.
        // Relying on string-matching `error.message` (e.g. .includes('410'))
        // is unreliable because the message text doesn't consistently contain
        // the status code, so expired/invalid subscriptions were never
        // getting cleaned up. Check statusCode directly instead.
        if (reason instanceof WebPushError) {
          console.error(
            `Failed to send notification to ${subscriptions[i].endpoint} (status ${reason.statusCode}):`,
            reason.body || reason.message
          );

          // 404 = subscription not found, 410 = subscription expired/gone.
          // Both mean the endpoint is permanently invalid and should be removed.
          if (reason.statusCode === 404 || reason.statusCode === 410) {
            await supabaseServer
              .from('wpx_push_subscriptions')
              .delete()
              .eq('endpoint', subscriptions[i].endpoint)
              .catch((err: unknown) => console.error('Error deleting subscription:', err));
          }
        } else {
          const error = reason instanceof Error ? reason : new Error(String(reason));
          console.error(`Failed to send notification to ${subscriptions[i].endpoint}:`, error.message);
        }
      }
    }

    return results;
  } catch (error: unknown) {
    console.error('Error sending push notification:', error);
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(userIds: string[], options: PushNotificationOptions) {
  const results = await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(userId, options))
  );
  return results;
}
