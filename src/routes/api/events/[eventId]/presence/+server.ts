import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { db, upsertPresence } from '$lib/server/store';
import { emitEvent } from '$lib/server/bus';

export const POST: RequestHandler = async ({ params, request }) => {
  const { eventId } = params;
  const event = eventId ? db.events.get(eventId) : undefined;
  if (!event) throw error(404, 'Event not found');
  const body = await request.json().catch(() => ({}));
  const token = String(body?.participantToken ?? '');
  const participant = Array.from(db.participants.values()).find(p => p.eventId === eventId && p.token === token);
  if (!participant) throw error(401, 'Invalid participant token');

  upsertPresence(participant.id, true, body?.clientInfo);
  // emit after presence stored
  try { emitEvent(eventId!, 'presence:update', { participantId: participant.id, connected: true }); } catch {}
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  const { eventId } = params;
  const event = eventId ? db.events.get(eventId) : undefined;
  if (!event) throw error(404, 'Event not found');
  const body = await request.json().catch(() => ({}));
  const token = String(body?.participantToken ?? '');
  const participant = Array.from(db.participants.values()).find(p => p.eventId === eventId && p.token === token);
  if (!participant) throw error(401, 'Invalid participant token');

  upsertPresence(participant.id, false);
  emitEvent(eventId!, 'presence:update', { participantId: participant.id, connected: false });
  return json({ ok: true });
};
