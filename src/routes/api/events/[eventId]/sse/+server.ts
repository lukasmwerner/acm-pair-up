import type { RequestHandler } from '@sveltejs/kit';
import { bus } from '$lib/server/bus';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
  const { eventId } = params;
  if (!eventId) return new Response('Bad Request', { status: 400 });

  setHeaders({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  let off: (() => void) | null = null;
  let closed = false;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const push = (msg: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          // ignore enqueue after close
        }
      };
      off = bus.on(`event:${eventId}`, push);
      try {
        controller.enqueue(encoder.encode(`event: ping\n` + `data: {\"ts\":${Date.now()}}\n\n`));
      } catch {}
    },
    cancel() {
      closed = true;
      if (off) { off(); off = null; }
    }
  });

  return new Response(stream);
};

