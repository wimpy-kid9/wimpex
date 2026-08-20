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

  let shouldPush = true;
  if (!['message', 'incoming_call', 'missed_call'].includes(type)) {
    const { data: profile } = await supabaseServer
      .from('wpx_profiles')
      .select('quiet_hours_start, quiet_hours_end, digest_notifications')
      .eq('user_id', userId)
      .maybeSingle();
    const start = profile?.quiet_hours_start?.slice?.(0, 5);
    const end = profile?.quiet_hours_end?.slice?.(0, 5);
    if (start && end) {
      const current = new Date().toTimeString().slice(0, 5);
      shouldPush = start <= end ? current < start || current >= end : current < start && current >= end;
    }
    if (profile?.digest_notifications) {
      metadata = { ...metadata, delivery: 'daily_digest' };
      shouldPush = false;
    }
  }

  await Promise.allSettled([
    supabaseServer.from('wpx_notifications').insert({
      user_id: userId,
      actor_id: actorId,
      type,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata
    }),
    shouldPush ? sendPushToUser(userId, push) : Promise.resolve()
  ]);
}