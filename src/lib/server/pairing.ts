import type { ID, Participant } from './types';
import { getAvoidance } from './store';

export function fnv1a32(x: number): number {
  let h = 0x811c9dc5 >>> 0;
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  view.setUint32(0, x >>> 0, true);
  for (let i = 0; i < 4; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function parseHex(hex: string): number {
  return parseInt(hex, 16) >>> 0;
}

function attemptPair(
  eventId: ID,
  connected: Participant[],
  roundIndex: number,
  roundSeed: number,
  window: number
): { pairs: [Participant, Participant][], waiting?: Participant } | null {
  const ranks = connected
    .map(p => ({ p, r: fnv1a32((parseHex(p.hexId) ^ roundSeed) >>> 0) }))
    .sort((a, b) => a.r - b.r);

  const pairs: [Participant, Participant][] = [];
  let waiting: Participant | undefined;

  for (let i = 0; i < ranks.length; ) {
    if (i === ranks.length - 1) { waiting = ranks[i].p; break; }
    const a = ranks[i].p;
    const b = ranks[i + 1].p;
    const last = getAvoidance(eventId, a.id, b.id);
    if (roundIndex - last > window) {
      pairs.push([a, b]);
      i += 2;
    } else {
      if (i + 2 < ranks.length) {
        const c = ranks[i + 2].p;
        const lastAC = getAvoidance(eventId, a.id, c.id);
        if (roundIndex - lastAC > window) {
          pairs.push([a, c]);
          const tmp = ranks[i + 1];
          ranks[i + 1] = ranks[i + 2];
          ranks[i + 2] = tmp;
          i += 2;
          continue;
        }
      }
      return null; // fallback path triggers
    }
  }
  return { pairs, waiting };
}

export function buildPairs(
  eventId: ID,
  connected: Participant[],
  roundIndex: number,
  roundSeed: number,
  window: number
): { pairs: [Participant, Participant][], waiting?: Participant, usedSeed: number } {
  const maxRetries = 5;
  let seed = roundSeed >>> 0;
  for (let i = 0; i <= maxRetries; i++) {
    const res = attemptPair(eventId, connected, roundIndex, seed, window);
    if (res) return { ...res, usedSeed: seed };
    seed = fnv1a32((seed ^ 0x9e3779b9) >>> 0);
  }
  // greedy with minimal repeats
  const sorted = [...connected].sort((a, b) => a.id.localeCompare(b.id));
  const pairs: [Participant, Participant][] = [];
  let waiting: Participant | undefined;
  for (let i = 0; i < sorted.length; ) {
    if (i === sorted.length - 1) { waiting = sorted[i]; break; }
    pairs.push([sorted[i], sorted[i + 1]]);
    i += 2;
  }
  return { pairs, waiting, usedSeed: seed };
}
