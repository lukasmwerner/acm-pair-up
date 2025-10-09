import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { db, getEventSummary } from '$lib/server/store';

export const GET: RequestHandler = async ({ params }) => {
  const { eventId } = params;
  const event = eventId ? db.events.get(eventId) : undefined;
  if (!event) throw error(404, 'Event not found');
  const summary = getEventSummary(eventId!);
  return json(summary);
};
