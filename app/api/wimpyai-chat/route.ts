export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';

/**
 * Proxies chat requests to the WimpyAI service.
 *
 * The client used to call https://wimpyai.vercel.app/api/chat directly from
 * the browser, which the browser blocks with a CORS error because WimpyAI's
 * response doesn't include an Access-Control-Allow-Origin header for
 * wimpex.vercel.app. Server-to-server requests aren't subject to CORS, so
 * routing the call through this same-origin API route sidesteps the problem
 * without needing any change on the WimpyAI side.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) return Response.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const gold = await isUserGold(authContext.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage, error: usageError } = await supabaseServer
    .from('wpx_ai_daily_usage')
    .select('message_count')
    .eq('user_id', authContext.user.id)
    .eq('usage_date', today)
    .maybeSingle();
  if (usageError) return Response.json({ error: usageError.message }, { status: 500 });

  const limit = gold ? 100 : 20;
  if ((usage?.message_count || 0) >= limit) {
    return Response.json({ error: `Daily WimpyAI limit reached (${limit} messages).`, gold }, { status: 429 });
  }

  const { error: usageWriteError } = await supabaseServer.from('wpx_ai_daily_usage').upsert({
    user_id: authContext.user.id,
    usage_date: today,
    message_count: (usage?.message_count || 0) + 1
  }, { onConflict: 'user_id,usage_date' });
  if (usageWriteError) return Response.json({ error: usageWriteError.message }, { status: 500 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }

  const wimpyaiUrl = process.env.WIMPYAI_URL || process.env.NEXT_PUBLIC_WIMPYAI_URL || 'https://wimpyai.vercel.app';

  try {
    const upstream = await fetch(`${wimpyaiUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    // WimpyAI streams its response as Server-Sent Events ("data: {...}\n\n"
    // lines terminated by "data: [DONE]"), not a single JSON object. The
    // old code did a blind JSON.parse(text) on the whole raw stream, which
    // always failed and fell back to `{ reply: text }` — dumping the raw
    // SSE text (including any upstream error payload) straight into the
    // chat as if it were the assistant's reply. Parse it properly instead.
    if (contentType.includes('text/event-stream') || text.includes('\ndata:') || text.startsWith('data:')) {
      const lines = text.split('\n').filter((line) => line.startsWith('data:'));
      let reply = '';
      let upstreamError: string | null = null;

      for (const line of lines) {
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        if (parsed?.error) {
          // Surface a clean, human-readable message instead of the nested
          // raw provider JSON (OpenRouter/OpenAI error payloads). The real
          // reason is often two levels deep: parsed.detail is a JSON
          // string whose .error.message is just OpenRouter's generic
          // wrapper ("Provider returned error") — the actual provider
          // message lives one level further, in .error.metadata.raw,
          // which is itself another JSON string.
          let detail: string = parsed.error;
          if (typeof parsed.detail === 'string') {
            try {
              const parsedDetail = JSON.parse(parsed.detail);
              const wrapperMessage = parsedDetail?.error?.message;
              const rawMetadata = parsedDetail?.error?.metadata?.raw;
              if (typeof rawMetadata === 'string') {
                try {
                  const parsedRaw = JSON.parse(rawMetadata);
                  detail = parsedRaw?.error?.message || wrapperMessage || parsed.error;
                } catch {
                  detail = wrapperMessage || parsed.error;
                }
              } else {
                detail = wrapperMessage || parsed.error;
              }
            } catch {
              detail = parsed.detail;
            }
          }
          upstreamError = typeof detail === 'string' ? detail : parsed.error;
          continue;
        }

        const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? parsed?.content ?? parsed?.reply ?? '';
        if (typeof delta === 'string') reply += delta;
      }

      if (upstreamError) {
        return Response.json({ error: `WimpyAI is temporarily unavailable: ${upstreamError}` }, { status: 502 });
      }
      if (!reply.trim()) {
        return Response.json({ error: 'WimpyAI returned an empty response. Please try again.' }, { status: 502 });
      }
      return Response.json({ reply });
    }

    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { reply: text };
    }

    if (!upstream.ok) {
      return Response.json(
        { error: payload?.error || 'WimpyAI service error' },
        { status: upstream.status }
      );
    }

    return Response.json({ reply: payload.reply ?? payload.message ?? '' });
  } catch (error) {
    console.error('Error proxying request to WimpyAI:', error);
    return Response.json({ error: 'Unable to reach WimpyAI. Please try again later.' }, { status: 502 });
  }
}
