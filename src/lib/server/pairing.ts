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

export function hashEmoji(emoji: string): number {
  let hash = 0;
  for (let i = 0; i < emoji.length; i++) {
    hash = emoji.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash >>> 0;
}

function attemptPair(
  eventId: ID,
  connected: Participant[],
  roundIndex: number,
  roundSeed: number,
  window: number
): { pairs: [Participant, Participant][], waiting?: Participant } | null {
  const ranks = connected
    .map(p => ({ p, r: fnv1a32((hashEmoji(p.emojiId) ^ roundSeed) >>> 0) }))
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

/**
 * Build groups of a specified size (2 or 4).
 * For groupSize=4, creates groups with no avoidance checking.
 * Handles remainders by creating smaller groups to minimize waiting.
 */
export function buildGroups(
  eventId: ID,
  connected: Participant[],
  roundIndex: number,
  roundSeed: number,
  groupSize: 2 | 4,
  window: number
): { groups: Participant[][], waiting?: Participant, usedSeed: number } {
  // For pairs, delegate to existing buildPairs function
  if (groupSize === 2) {
    const result = buildPairs(eventId, connected, roundIndex, roundSeed, window);
    return { groups: result.pairs, waiting: result.waiting, usedSeed: result.usedSeed };
  }

  // For groups of 4
  const n = connected.length;

  // Edge case: fewer than 4 people, fall back to pairs
  if (n < 4) {
    const result = buildPairs(eventId, connected, roundIndex, roundSeed, window);
    return { groups: result.pairs, waiting: result.waiting, usedSeed: result.usedSeed };
  }

  // Calculate optimal group distribution
  const remainder = n % 4;
  let numGroupsOf4: number;
  let numGroupsOf3: number;
  let numGroupsOf2: number;

  if (remainder === 0) {
    // Perfect division: all groups of 4
    numGroupsOf4 = Math.floor(n / 4);
    numGroupsOf3 = 0;
    numGroupsOf2 = 0;
  } else if (remainder === 1) {
    // Example: 9 → 1 group of 4 + 1 group of 3 + 1 group of 2
    // Example: 13 → 2 groups of 4 + 1 group of 3 + 1 group of 2
    if (n >= 9) {
      numGroupsOf4 = Math.floor((n - 5) / 4);
      numGroupsOf3 = 1;
      numGroupsOf2 = 1;
    } else {
      // 5 people: 1 group of 3 + 1 group of 2
      numGroupsOf4 = 0;
      numGroupsOf3 = 1;
      numGroupsOf2 = 1;
    }
  } else if (remainder === 2) {
    // Example: 10 → 2 groups of 4 + 1 group of 2
    numGroupsOf4 = Math.floor((n - 2) / 4);
    numGroupsOf3 = 0;
    numGroupsOf2 = 1;
  } else {
    // remainder === 3
    // Example: 7 → 1 group of 4 + 1 group of 3
    numGroupsOf4 = Math.floor((n - 3) / 4);
    numGroupsOf3 = 1;
    numGroupsOf2 = 0;
  }

  // Deterministic ranking (no avoidance for groups of 4)
  const seed = roundSeed >>> 0;
  const ranks = connected
    .map(p => ({ p, r: fnv1a32((hashEmoji(p.emojiId) ^ seed) >>> 0) }))
    .sort((a, b) => a.r - b.r);

  const groups: Participant[][] = [];
  let index = 0;

  // Create groups of 4
  for (let i = 0; i < numGroupsOf4; i++) {
    groups.push(ranks.slice(index, index + 4).map(r => r.p));
    index += 4;
  }

  // Create groups of 3
  for (let i = 0; i < numGroupsOf3; i++) {
    groups.push(ranks.slice(index, index + 3).map(r => r.p));
    index += 3;
  }

  // Create groups of 2
  for (let i = 0; i < numGroupsOf2; i++) {
    groups.push(ranks.slice(index, index + 2).map(r => r.p));
    index += 2;
  }

  return { groups, waiting: undefined, usedSeed: seed };
}
