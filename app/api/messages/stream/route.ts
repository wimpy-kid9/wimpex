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

      interval = setInterval(() => {
        send({ ts: Date.now() });
      }, 500);

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
