import { supabaseServer } from '@/lib/supabase-server';
import { isGoldSubscription } from '@/lib/subscription';

export async function isUserGold(userId: string) {
  const { data: subscription } = await supabaseServer
    .from('subscriptions')
    .select('id, user_id, status, current_period_end, plan_id, plans!plan_id(id, product_name, name, price, billing_interval)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  return isGoldSubscription(subscription);
}
