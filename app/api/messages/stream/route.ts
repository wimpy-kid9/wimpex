import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let ping = true;

      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // ignore
        }
      };

      const interval = setInterval(() => {
        // lightweight heartbeat/update event — clients should re-fetch state
        send({ ts: Date.now() });
      }, 3000);

      controller.enqueue(encoder.encode(`event: connected\ndata: {"ok":true}\n\n`));

      return () => {
        clearInterval(interval);
      };
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
