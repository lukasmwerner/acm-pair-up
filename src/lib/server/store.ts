import type { AvoidanceHistoryEntry, Event, EventSummary, ID, Pairing, Participant, Presence, Round } from './types';

function now() { return Date.now(); }
function randomId(prefix = ''): ID { return prefix + Math.random().toString(36).slice(2, 10); }
function randomToken(): string { return crypto.getRandomValues(new Uint32Array(4)).join('-'); }

export const db = {
  events: new Map<ID, Event>(),
  participants: new Map<ID, Participant>(),
  presence: new Map<ID, Presence>(), // key: participantId
  rounds: new Map<ID, Round>(),
  pairings: new Map<ID, Pairing>(),
  eventRounds: new Map<ID, ID[]>(), // eventId -> roundIds
  roundPairs: new Map<ID, ID[]>(), // roundId -> pairingIds
  avoidance: new Map<string, AvoidanceHistoryEntry>(), // `${eventId}:${p1}:${p2}` sorted ids
};

export function createEvent(name: string, code: string): Event {
  const id = randomId('evt_');
  const adminKey = randomId('adm_');
  const event: Event = {
    id,
    name,
    code,
    status: 'open',
    settings: { avoidRepeatWindow: 3, oddHandling: 'waiting', hexLength: 2 },
    createdAt: now(),
    adminKey,
  };
  db.events.set(id, event);
  db.eventRounds.set(id, []);
  return event;
}

export function generateHexId(eventId: ID, hexLength: number): string {
  const existing = new Set(
    Array.from(db.participants.values()).filter(p => p.eventId === eventId).map(p => p.hexId.toUpperCase())
  );
  const maxTries = 2048;
  for (let i = 0; i < maxTries; i++) {
    let hex = '';
    for (let j = 0; j < hexLength; j++) {
      hex += Math.floor(Math.random() * 16).toString(16);
    }
    hex = hex.toUpperCase();
    if (!existing.has(hex)) return hex;
  }
  throw new Error('Unable to allocate unique hex id');
}

export function joinEvent(eventId: ID, code: string, displayName?: string) {
  const event = db.events.get(eventId);
  if (!event) throw new Error('Event not found');
  if (event.code !== code) throw new Error('Invalid code');
  const hexId = generateHexId(eventId, event.settings.hexLength);
  const id = randomId('usr_');
  const token = randomToken();
  const participant: Participant = { id, eventId, hexId, displayName, token, createdAt: now() };
  db.participants.set(id, participant);
  const presence: Presence = { participantId: id, eventId, connected: false, lastSeenAt: 0 };
  db.presence.set(id, presence);
  return { participant, token };
}

export function getEventSummary(eventId: ID): EventSummary | undefined {
  const event = db.events.get(eventId);
  if (!event) return undefined;
  const rounds = db.eventRounds.get(eventId) ?? [];
  const round = rounds.length ? db.rounds.get(rounds[rounds.length - 1]) : undefined;
  const participants = Array.from(db.participants.values()).filter(p => p.eventId === eventId);
  const list = participants.map(p => ({
    ...p,
    presence: db.presence.get(p.id)
  }));
  const connectedCount = list.filter(p => p.presence?.connected).length;
  return { event, participants: list, round, connectedCount };
}

export function upsertPresence(participantId: ID, connected: boolean, clientInfo?: Record<string, unknown>) {
  const presence = db.presence.get(participantId);
  if (!presence) return;
  presence.connected = connected;
  presence.lastSeenAt = now();
  if (clientInfo) presence.clientInfo = clientInfo;
}

export function createRound(eventId: ID, index: number, roundSeed: number): Round {
  const id = randomId('rnd_');
  const round: Round = { id, eventId, index, createdAt: now(), roundSeed };
  db.rounds.set(id, round);
  const arr = db.eventRounds.get(eventId) ?? [];
  arr.push(id);
  db.eventRounds.set(eventId, arr);
  return round;
}

export function setAvoidance(eventId: ID, p1Id: ID, p2Id: ID, roundIndex: number) {
  const [a, b] = [p1Id, p2Id].sort();
  const key = `${eventId}:${a}:${b}`;
  db.avoidance.set(key, { eventId, p1Id: a, p2Id: b, lastPairedRoundIndex: roundIndex });
}

export function getAvoidance(eventId: ID, p1Id: ID, p2Id: ID): number {
  const [a, b] = [p1Id, p2Id].sort();
  const key = `${eventId}:${a}:${b}`;
  return db.avoidance.get(key)?.lastPairedRoundIndex ?? -1_000_000;
}

export function savePairings(roundId: ID, pairs: Array<Omit<Pairing, 'id'>>): Pairing[] {
  const ids: ID[] = [];
  const list: Pairing[] = [];
  for (const p of pairs) {
    const id = randomId('pr_');
    const row: Pairing = { id, ...p } as Pairing;
    db.pairings.set(id, row);
    ids.push(id);
    list.push(row);
  }
  db.roundPairs.set(roundId, ids);
  return list;
}

export function getConnectedParticipants(eventId: ID): Participant[] {
  return Array.from(db.participants.values()).filter(p => p.eventId === eventId && (db.presence.get(p.id)?.connected ?? false));
}

export function getRoundIndex(eventId: ID): number {
  const rounds = db.eventRounds.get(eventId) ?? [];
  return rounds.length;
}
