import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createEvent, db } from '$lib/server/store';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? 'Speed Friending');
  let code = String(body?.code ?? '').trim();
  if (!code) code = Math.random().toString(36).slice(2, 6).toUpperCase();
  const event = createEvent(name, code);
  return json({ event: { id: event.id, name: event.name, code: event.code, adminKey: event.adminKey } });
};

export const GET: RequestHandler = async () => {
  const list = Array.from(db.events.values()).map(e => ({ id: e.id, name: e.name, code: e.code }));
  return json({ events: list });
};
