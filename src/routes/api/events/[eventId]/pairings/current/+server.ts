import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/store';

export const GET: RequestHandler = async ({ params }) => {
  const { eventId } = params;
  const event = eventId ? db.events.get(eventId) : undefined;
  if (!event) throw error(404, 'Event not found');
  const rounds = db.eventRounds.get(eventId!) ?? [];
  if (!rounds.length) return json({ round: null, pairings: [] });
  const roundId = rounds[rounds.length - 1];
  const round = db.rounds.get(roundId)!;
  const pairIds = db.roundPairs.get(roundId) ?? [];
  const pairings = pairIds.map(id => db.pairings.get(id));
  return json({ round, pairings });
};
