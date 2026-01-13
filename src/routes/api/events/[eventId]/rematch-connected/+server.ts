import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { db, createRound, getConnectedParticipants, getRoundIndex, savePairings, setAvoidance } from '$lib/server/store';
import { buildGroups, fnv1a32 } from '$lib/server/pairing';
import { emitEvent } from '$lib/server/bus';
import type { Pairing } from '$lib/server/types';

export const POST: RequestHandler = async ({ params, request }) => {
  const { eventId } = params;
  const event = eventId ? db.events.get(eventId) : undefined;
  if (!event) throw error(404, 'Event not found');
  const body = await request.json().catch(() => ({}));
  const adminKey = String(body?.adminKey ?? '');
  if (adminKey !== event.adminKey) throw error(403, 'Forbidden');

  // Extract and validate groupSize
  const groupSize = body?.groupSize ?? 2;
  if (groupSize !== 2 && groupSize !== 4) {
    throw error(400, 'Invalid groupSize: must be 2 or 4');
  }

  const roundIndex = getRoundIndex(event.id);
  // idempotency: if last rematch < 1s ago, reject
  const now = Date.now();
  if (event.lastRematch && now - event.lastRematch.at < 1000) {
    return json({ skipped: true });
  }
  event.lastRematch = { at: now, key: crypto.randomUUID?.() };

  const connected = getConnectedParticipants(event.id);
  const seed = (typeof body?.roundSeed === 'number') ? body.roundSeed >>> 0 : fnv1a32((now & 0xffffffff) >>> 0);
  const res = buildGroups(event.id, connected, roundIndex, seed, groupSize, event.settings.avoidRepeatWindow);
  const round = createRound(event.id, roundIndex + 1, res.usedSeed);

  // Convert groups to pairings format
  const pairsToSave: Array<Omit<Pairing, 'id'>> = res.groups.map(group => {
    const pairing: Omit<Pairing, 'id'> = {
      roundId: round.id,
      aParticipantId: group[0].id,
      bParticipantId: group[1].id,
      groupSize: group.length as 2 | 3 | 4
    };
    if (group[2]) pairing.cParticipantId = group[2].id;
    if (group[3]) pairing.dParticipantId = group[3].id;
    return pairing;
  });

  const saved = savePairings(round.id, pairsToSave);

  // Update avoidance only for pairs (groupSize === 2)
  for (const p of saved) {
    if (p.groupSize === 2) {
      setAvoidance(event.id, p.aParticipantId, p.bParticipantId, round.index);
    }
  }

  try { emitEvent(event.id, 'pairings:updated', { round }); } catch {}
  return json({ round, pairings: saved, waiting: res.waiting?.id ?? null });
};
