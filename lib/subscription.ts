export function isGoldSubscription(subscription: any | null | undefined) {
  if (!subscription) return false;

  const planText = [
    subscription.plan,
    subscription.plan_name,
    subscription.product_name,
    subscription.metadata?.plan,
    subscription.metadata?.plan_name,
    subscription.metadata?.product_name,
    subscription.metadata?.tier
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return planText.includes('gold') || (subscription.status === 'active' && subscription.metadata?.tier === 'gold');
}

export function isGoldStatus(status: string | null | undefined) {
  return (status || '').toLowerCase() === 'active';
}

export async function requireGoldSubscription(fetchSubscription: () => Promise<any | null>) {
  const subscription = await fetchSubscription();
  return isGoldSubscription(subscription) && isGoldStatus(subscription?.status);
}
