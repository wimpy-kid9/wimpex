import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

function calculateExpiry(days = 30) {
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + days);
  return expires.toISOString();
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
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const productName = body.product_name || 'wimpex';
  const planName = body.plan_name || body.plan || 'gold_monthly';

  const externalApiUrl = process.env.WIMPYPAY_API_URL;
  const internalApiKey = process.env.WIMPYPAY_INTERNAL_API_KEY;
  let externalReference: string | null = null;
  let activeUntil = calculateExpiry(30);

  if (externalApiUrl && internalApiKey) {
    try {
      const response = await fetch(`${externalApiUrl}/api/external/subscribe`, {
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
        const errorBody = await response.text();
        return NextResponse.json({ error: `WimpyPay error: ${errorBody}` }, { status: 502 });
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

  return NextResponse.json({ subscription: data });
}
