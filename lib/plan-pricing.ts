export type PlanPricePayload = {
  ok?: boolean;
  price?: number | string;
  amount?: number | string;
  billing_interval?: string;
  billingInterval?: string;
  plan?: {
    price?: number | string;
    amount?: number | string;
    billing_interval?: string;
    billingInterval?: string;
    name?: string;
    product_name?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export function extractPlanPrice(payload: PlanPricePayload | null | undefined) {
  const plan = payload?.plan ?? {};
  const rawPrice =
    payload?.price ??
    payload?.amount ??
    plan?.price ??
    plan?.amount ??
    0;

  const rawInterval =
    payload?.billing_interval ??
    payload?.billingInterval ??
    plan?.billing_interval ??
    plan?.billingInterval ??
    'monthly';

  return {
    price: Number(rawPrice ?? 0),
    billing_interval: String(rawInterval || 'monthly')
  };
}
