import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

const WIMPEX_PRODUCT_NAME = 'wimpex';
const WIMPEX_PLAN_NAME = 'Wimpex Pro';

function calculateExpiry(days = 30) {
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
}

function normalizeProductName(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : WIMPEX_PRODUCT_NAME;
}

function normalizePlanName(value: unknown) {
  if (typeof value !== 'string') {
    return WIMPEX_PLAN_NAME;
  }

  const normalized = value.trim();
  const lowered = normalized.toLowerCase();

  if (!normalized) {
    return WIMPEX_PLAN_NAME;
  }

  if (['gold_monthly', 'gold', 'wimpex_pro', 'wimpex pro', 'wimpex-pro'].includes(lowered)) {
    return WIMPEX_PLAN_NAME;
  }

  return normalized;
}

async function fetchPlanPrice(productName: string, planName: string) {
  const externalApiUrl = process.env.WIMPYPAY_API_URL;
  const internalApiKey = process.env.WIMPYPAY_INTERNAL_API_KEY;

  if (!externalApiUrl || !internalApiKey) {
    throw new Error('WimpyPay is not configured on the server.');
  }

  const url = new URL(`${externalApiUrl.replace(/\/$/, '')}/api/external/plan`);
  url.searchParams.set('product_name', productName);
  url.searchParams.set('plan_name', planName);

  const response = await fetch(url.toString(), {
    headers: {
      'x-internal-api-key': internalApiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Unable to fetch plan price.');
  }

  const payload = await response.json().catch(() => ({}));
  return {
    product_name: productName,
    plan_name: planName,
    price: Number(payload.price ?? payload.amount ?? 0),
    billing_interval: payload.billing_interval || payload.billingInterval || 'monthly'
  };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ subscription: null });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestedProductName = request.nextUrl.searchParams.get('product_name') || WIMPEX_PRODUCT_NAME;
  const requestedPlanName = request.nextUrl.searchParams.get('plan_name');

  if (requestedPlanName) {
    try {
      const plan = await fetchPlanPrice(
        normalizeProductName(requestedProductName),
        normalizePlanName(requestedPlanName)
      );

      return NextResponse.json(plan);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to fetch plan price.' }, { status: 502 });
    }
  }

  const { data, error } = await supabaseServer
    .from('wpx_subscriptions')
    .select('*')
    .eq('user_id', authContext.user.id)
    .eq('status', 'active')
    .order('active_until', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscription: data || null });
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
    }

    let authContext;
    try {
      authContext = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // If body parsing fails, continue with empty object
      body = {};
    }

    const requestedProductName = typeof body.product_name === 'string' ? body.product_name : WIMPEX_PRODUCT_NAME;
    const requestedPlanName = body.plan_name ?? body.plan ?? WIMPEX_PLAN_NAME;

    if (normalizeProductName(requestedProductName) !== WIMPEX_PRODUCT_NAME) {
      return NextResponse.json({ error: 'Only WIMPEX product plans can be purchased here.' }, { status: 400 });
    }

    const productName = WIMPEX_PRODUCT_NAME;
    const planName = normalizePlanName(requestedPlanName);

    const externalApiUrl = process.env.WIMPYPAY_API_URL;
    const internalApiKey = process.env.WIMPYPAY_INTERNAL_API_KEY;
    let externalReference: string | null = null;
    let activeUntil = calculateExpiry(30);

    if (externalApiUrl && internalApiKey) {
      try {
        const response = await fetch(`${externalApiUrl.replace(/\/$/, '')}/api/external/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': internalApiKey
          },
          body: JSON.stringify({
            user_id: authContext.user.id,
            product_name: productName,
            plan_name: planName,
            reference: `wimpex-sub-${Date.now()}`
          })
        });

        if (!response.ok) {
          const responseText = await response.text();
          let parsed: any = {};
          try {
            parsed = JSON.parse(responseText);
          } catch {
            parsed = {};
          }

          if (parsed.error === 'insufficient_funds' || parsed.code === 'insufficient_funds') {
            return NextResponse.json({
              error: 'insufficient_funds',
              requiredAmount: Number(parsed.requiredAmount ?? parsed.required_amount ?? 0),
              currentBalance: Number(parsed.currentBalance ?? parsed.current_balance ?? 0),
              product_name: productName,
              plan_name: planName
            }, { status: 402 });
          }

          return NextResponse.json({
            error: parsed.error || responseText || 'WimpyPay purchase failed.',
            product_name: productName,
            plan_name: planName
          }, { status: 502 });
        }

        const payload = await response.json().catch(() => ({}));
        externalReference = payload.subscriptionId || payload.subscription_id || payload.id || null;
        activeUntil = payload.current_period_end || payload.active_until || activeUntil;
      } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'WimpyPay service unavailable.' }, { status: 502 });
      }
    }

    const { data, error } = await supabaseServer.from('wpx_subscriptions').insert({
      user_id: authContext.user.id,
      plan: planName,
      status: 'active',
      active_from: new Date().toISOString(),
      active_until: activeUntil,
      external_reference: externalReference,
      metadata: {
        source: 'wimpypay_router',
        product_name: productName,
        plan_name: planName
      }
    }).select().maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscription: data, product_name: productName, plan_name: planName });
  } catch (error: any) {
    // Catch any uncaught errors to prevent 502
    console.error('POST /api/wimpypay error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Internal server error processing purchase.' 
    }, { status: 500 });
  }
}
