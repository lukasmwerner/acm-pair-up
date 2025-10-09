import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { db, joinEvent } from '$lib/server/store';

export const POST: RequestHandler = async ({ params, request }) => {
  const { eventId } = params;
  const event = eventId ? db.events.get(eventId) : undefined;
  if (!event) throw error(404, 'Event not found');
  const body = await request.json().catch(() => ({}));
  const code = String(body?.code ?? '');
  const displayName = body?.displayName ? String(body.displayName) : undefined;
  try {
    const { participant, token } = joinEvent(event.id, code, displayName);
    return json({ participantToken: token, hexId: participant.hexId, participantId: participant.id });
  } catch (e: any) {
    throw error(400, e?.message ?? 'Join failed');
  }
};
