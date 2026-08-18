function flattenPlanLabels(value: any): string[] {
  if (!value) return [];

  if (typeof value === 'string') {
    return [value];
  }

  if (typeof value === 'object') {
    return Object.values(value).flatMap((entry) => flattenPlanLabels(entry));
  }

  return [];
}

export function isGoldSubscription(subscription: any | null | undefined) {
  if (!subscription) return false;

  const planCandidates = [
    subscription.plan,
    subscription.plans,
    subscription.plan_name,
    subscription.product_name,
    subscription.metadata?.plan,
    subscription.metadata?.plan_name,
    subscription.metadata?.product_name,
    subscription.metadata?.tier,
    subscription.plan_id,
    subscription.plan?.name,
    subscription.plans?.name,
    subscription.plan?.product_name,
    subscription.plans?.product_name
  ];

  const planText = flattenPlanLabels(planCandidates)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const isWimpexProPlan = planText.includes('wimpex') && (planText.includes('pro') || planText.includes('premium'));
  const isGoldPlan = planText.includes('gold') || isWimpexProPlan;

  return isGoldPlan || (subscription.status === 'active' && (subscription.metadata?.tier === 'gold' || subscription.plans?.name?.toLowerCase?.().includes('gold')));
}

export function isGoldStatus(status: string | null | undefined) {
  return (status || '').toLowerCase() === 'active';
}

export async function requireGoldSubscription(fetchSubscription: () => Promise<any | null>) {
  const subscription = await fetchSubscription();
  return isGoldSubscription(subscription) && isGoldStatus(subscription?.status);
}
