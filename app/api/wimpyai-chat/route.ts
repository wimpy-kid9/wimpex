export const dynamic = 'force-dynamic';

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
export async function POST(request: Request) {
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
