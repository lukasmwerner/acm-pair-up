export type ID = string;

export type EventStatus = 'open' | 'closed';

export interface Event {
  id: ID;
  name: string;
  code: string; // join code
  status: EventStatus;
  currentRoundId?: ID;
  settings: EventSettings;
  createdAt: number;
  adminKey: string; // simple per-event admin token for MVP
  lastRematch?: { at: number; key?: string };
}

export interface EventSettings {
  avoidRepeatWindow: number; // rounds
  oddHandling: 'waiting' | 'trio';
  hexLength: number; // default 2
}

export interface Participant {
  id: ID;
  eventId: ID;
  hexId: string; // short hex like 'A3'
  displayName?: string;
  token: string; // participant token for presence/auth
  createdAt: number;
}

export interface Presence {
  participantId: ID;
  eventId: ID;
  connected: boolean;
  lastSeenAt: number; // ms epoch
  clientInfo?: Record<string, unknown>;
}

export interface Round {
  id: ID;
  eventId: ID;
  index: number;
  createdAt: number;
  roundSeed: number; // uint32
}

export interface Pairing {
  id: ID;
  roundId: ID;
  aParticipantId: ID;
  bParticipantId: ID;
  isTrio?: boolean;
  cParticipantId?: ID | null;
}

export interface AvoidanceHistoryKey {
  p1: ID;
  p2: ID;
}

export interface AvoidanceHistoryEntry {
  eventId: ID;
  p1Id: ID;
  p2Id: ID;
  lastPairedRoundIndex: number;
}

export interface AdminUser { id: ID; email: string; role: 'owner' | 'admin'; }

export interface EventSummary {
  event: Event;
  participants: Array<Participant & { presence: Presence | undefined; currentPair?: ID | undefined }>;
  round?: Round;
  connectedCount: number;
}
