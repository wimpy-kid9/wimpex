import webpush from 'web-push';
import { supabaseServer, isSupabaseServerConfigured } from '@/lib/supabase-server';

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
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(userId: string, options: PushNotificationOptions) {
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
      url: options.url
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
        const error = reason instanceof Error ? reason : new Error(String(reason));
        console.error(`Failed to send notification to ${subscriptions[i].endpoint}:`, error.message);

        // Remove expired/invalid subscriptions
        if (
          error.message.includes('410') ||
          error.message.includes('gone') ||
          error.message.includes('invalid')
        ) {
          await supabaseServer
            .from('wpx_push_subscriptions')
            .delete()
            .eq('endpoint', subscriptions[i].endpoint)
            .catch((err: unknown) => console.error('Error deleting subscription:', err));
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
