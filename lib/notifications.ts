import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { PushNotificationOptions, sendPushToUser } from '@/lib/push-notifications';

export interface CreateNotificationOptions {
  userId: string;
  actorId?: string | null;
  type: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  push: PushNotificationOptions;
}

export async function createNotification({
  userId,
  actorId = null,
  type,
  resourceType,
  resourceId = null,
  metadata = {},
  push
}: CreateNotificationOptions) {
  if (!isSupabaseServerConfigured) return;

  await Promise.allSettled([
    supabaseServer.from('wpx_notifications').insert({
      user_id: userId,
      actor_id: actorId,
      type,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata
    }),
    sendPushToUser(userId, push)
  ]);
}