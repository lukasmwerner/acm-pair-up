import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { db, createRound, getConnectedParticipants, getRoundIndex, savePairings, setAvoidance } from '$lib/server/store';
import { buildPairs, fnv1a32 } from '$lib/server/pairing';
import { emitEvent } from '$lib/server/bus';

export const POST: RequestHandler = async ({ params, request }) => {
  const { eventId } = params;
  const event = eventId ? db.events.get(eventId) : undefined;
  if (!event) throw error(404, 'Event not found');
  const body = await request.json().catch(() => ({}));
  const adminKey = String(body?.adminKey ?? '');
  if (adminKey !== event.adminKey) throw error(403, 'Forbidden');

  const roundIndex = getRoundIndex(event.id);
  // idempotency: if last rematch < 1s ago, reject
  const now = Date.now();
  if (event.lastRematch && now - event.lastRematch.at < 1000) {
    return json({ skipped: true });
  }
  event.lastRematch = { at: now, key: crypto.randomUUID?.() };

  const connected = getConnectedParticipants(event.id);
  const seed = (typeof body?.roundSeed === 'number') ? body.roundSeed >>> 0 : fnv1a32((now & 0xffffffff) >>> 0);
  const res = buildPairs(event.id, connected, roundIndex, seed, event.settings.avoidRepeatWindow);
  const round = createRound(event.id, roundIndex + 1, res.usedSeed);
  const pairsToSave = res.pairs.map(([a,b]) => ({ roundId: round.id, aParticipantId: a.id, bParticipantId: b.id }));
  const saved = savePairings(round.id, pairsToSave);
  // update avoidance
  for (const p of saved) setAvoidance(event.id, p.aParticipantId, p.bParticipantId, round.index);

  try { emitEvent(event.id, 'pairings:updated', { round }); } catch {}
  return json({ round, pairings: saved, waiting: res.waiting?.id ?? null });
};
