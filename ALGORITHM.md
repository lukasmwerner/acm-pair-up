# Matching Algorithm Explained

This document explains how the ACM Pair-Up matching algorithm works, particularly how it avoids pairing the same people for up to 3 rounds.

## The Core Algorithm

### Step 1: Deterministic Ranking

For each round, every participant gets a "rank" based on their emoji and a random seed:

```
rank = FNV1a32(hashEmoji(emojiId) XOR roundSeed)
```

**Example:** Round 1 with seed `12345`
- 🐶 Dog → hash: `98234` → `98234 XOR 12345` → FNV1a32 → rank: `450123`
- 🐱 Cat → hash: `76543` → `76543 XOR 12345` → FNV1a32 → rank: `892341`
- 🐭 Mouse → hash: `54321` → `54321 XOR 12345` → FNV1a32 → rank: `123456`
- 🦊 Fox → hash: `88888` → `88888 XOR 12345` → FNV1a32 → rank: `678901`

After sorting by rank: `[🐭, 🐶, 🦊, 🐱]`

### Step 2: Adjacent Pairing

Pair adjacent people in the sorted list:
- Pair 1: `🐭 ↔ 🐶`
- Pair 2: `🦊 ↔ 🐱`

## The 3-Round Avoidance Window

Here's where it gets interesting! Before creating each pair, the algorithm checks:

```typescript
if (roundIndex - lastPairedRound > window) {
  // OK to pair!
} else {
  // They were paired too recently, try something else
}
```

### How Avoidance Tracking Works

**After each pairing**, the system records:
```typescript
setAvoidance(eventId, "🐭", "🐶", roundIndex: 1)
```

This creates a record: `"🐭 and 🐶 were last paired in round 1"`

**Before pairing in future rounds**, it checks:
```typescript
lastPaired = getAvoidance(eventId, "🐭", "🐶") // returns 1
if (currentRound - lastPaired > 3) {
  // OK! Round 5 - Round 1 = 4, which is > 3, so allowed!
}
```

### Example Across Multiple Rounds

Let's trace 5 rounds with 6 people:

**Round 1** (seed: 12345):
- Sorted: `[🐭, 🐶, 🦊, 🐱, 🐰, 🐻]`
- Pairs: `🐭↔🐶`, `🦊↔🐱`, `🐰↔🐻`
- Records: `(🐭,🐶):1`, `(🦊,🐱):1`, `(🐰,🐻):1`

**Round 2** (seed: 67890, different order):
- Sorted: `[🐱, 🐭, 🐻, 🐶, 🐰, 🦊]`
- Try pairing `🐱↔🐭`: Check avoidance → No recent history → ✅ Pair them!
- Try pairing `🐻↔🐶`: Check avoidance → No recent history → ✅ Pair them!
- Try pairing `🐰↔🦊`: Check avoidance → No recent history → ✅ Pair them!
- Records: `(🐱,🐭):2`, `(🐻,🐶):2`, `(🐰,🦊):2`

**Round 3** (seed: 11111):
- Sorted: `[🐶, 🐭, 🦊, 🐱, 🐰, 🐻]`
- Try pairing `🐶↔🐭`: Last paired in round 1 → `3 - 1 = 2` → **Too recent!** ❌

**What happens when there's a conflict?** The algorithm tries to "swap":

```typescript
// Can't pair 🐶↔🐭 (paired in round 1)
// Try pairing 🐶 with the NEXT person instead: 🐶↔🦊
if (roundIndex - getAvoidance("🐶", "🦊") > 3) {
  // OK! Pair 🐶↔🦊 and swap positions
  // New order: [🐶, 🦊, 🐭, 🐱, 🐰, 🐻]
  //             └──✓──┘ └──✓──┘ └──✓──┘
}
```

This local swap operation maintains the overall pairing while resolving the conflict.

## Strategy Hierarchy

The algorithm uses a multi-level strategy to handle conflicts:

### 1. Local Swapping (First Attempt)

When adjacent pairs have a conflict, try swapping with the next person:

```typescript
// Original order: [A, B, C, D, ...]
// Can't pair A↔B (recent history)
// Try: A↔C instead
// If OK: pairs become [A↔C, B↔D, ...]
```

This is implemented in `pairing.ts` lines 46-57.

### 2. Re-seeding (Up to 5 Retries)

If swapping doesn't resolve the conflict, generate a new seed and try the entire pairing from scratch:

```typescript
seed = FNV1a32(seed XOR 0x9e3779b9) // Mix constant
// This creates a completely different rank ordering
```

Different seed → Different ordering → Different adjacent pairs → Hopefully no conflicts!

The algorithm tries up to 5 different seeds before giving up (`buildPairs` function, lines 72-77).

### 3. Greedy Pairing (Ultimate Fallback)

After 5 failed attempts with different seeds, the algorithm accepts that perfect avoidance isn't possible and falls back to simple ID-based pairing:

```typescript
// Sort alphabetically by participant ID: [A, B, C, D, E, F]
// Pair adjacent: A↔B, C↔D, E↔F
// May violate the 3-round window, but ensures everyone gets paired
```

This ensures the system never fails to create pairings, even with difficult constraints.

## The Avoidance Window in Practice

The window of **3** means: **"Don't pair people who were together in the last 3 rounds"**

Timeline for a specific pair:
- **Round 1**: Paired ✅
- **Round 2**: Blocked (1 round ago)
- **Round 3**: Blocked (2 rounds ago)
- **Round 4**: Blocked (3 rounds ago)
- **Round 5**: Allowed! (4 rounds ago) ✅

The check is: `currentRound - lastPairedRound > window`
- Round 5 - Round 1 = 4
- 4 > 3 ✓ → Pairing allowed

## Why This Design Works

1. **Different seed each round** → Different orderings → Natural variety
2. **Avoidance check before pairing** → Prevents recent repeats
3. **Local swapping** → Fixes small conflicts without re-rolling everything
4. **Re-seeding** → Handles larger conflict clusters by trying different arrangements
5. **Deterministic** → Same seed + same people = same pairing (useful for debugging and testing)
6. **Graceful degradation** → Always produces a valid pairing, even if constraints can't be satisfied

## Implementation Details

### Hash Functions

**`hashEmoji(emoji)`**: Converts emoji to a number
```typescript
let hash = 0;
for (let i = 0; i < emoji.length; i++) {
  hash = emoji.charCodeAt(i) + ((hash << 5) - hash);
}
return hash >>> 0; // Unsigned 32-bit
```

**`fnv1a32(x)`**: FNV-1a hash algorithm for mixing
- Industry-standard hash function with good distribution
- Fast computation for real-time pairing
- Produces uniform pseudo-random rankings

### Data Storage

The avoidance history is stored in a Map with compound keys:

```typescript
key = `${eventId}:${participantId1}:${participantId2}` // IDs sorted alphabetically
value = { lastPairedRoundIndex: number }
```

This allows O(1) lookup when checking if two people were recently paired.

### Edge Cases

- **Odd number of participants**: Last person in sorted list becomes `waiting`
- **Small groups**: With 4 people, after 2 rounds all pairs have been made once, so round 3 will necessarily repeat a pair (but the 3-round window means they won't repeat for 2 more rounds)
- **Impossible constraints**: Greedy fallback ensures pairing always succeeds

## Code References

- Main algorithm: `src/lib/server/pairing.ts`
- Avoidance tracking: `src/lib/server/store.ts` (lines 741-751)
- Round creation: `src/routes/api/events/[eventId]/rematch-connected/+server.ts`
