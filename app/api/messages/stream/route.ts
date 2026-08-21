export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  let interval: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // ignore
        }
      };

      // This has no real change-detection behind it (no DB LISTEN/NOTIFY or
      // Supabase Realtime subscription) — it's a fixed-interval "check now"
      // ping that the client treats as "something changed, reload the
      // conversation list." It was previously firing every 500 *milliseconds*,
      // forever, for as long as the tab was open. Because this runs on the
      // Edge runtime, the connection stays open reliably on Vercel (unlike a
      // regular serverless function), so this loop — not the client's
      // fallback poller — was almost certainly the real source of the
      // constant /api/messages + /api/connections traffic. 8s keeps the
      // list feeling reasonably live without re-fetching twice a second.
      interval = setInterval(() => {
        send({ ts: Date.now() });
      }, 8000);

      controller.enqueue(encoder.encode(`event: connected\ndata: {"ok":true}\n\n`));

      // Stop pushing and close the stream as soon as the client disconnects,
      // instead of leaving the interval running until the platform kills it.
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch (e) {
          // already closed
        }
      });
    },
    cancel() {
      clearInterval(interval);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}