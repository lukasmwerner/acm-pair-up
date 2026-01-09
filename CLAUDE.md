# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Speed Friending Pair-Up is a real-time web app for managing 1:1 pairing rounds at events. Participants join an event and get randomly paired with others for "speed friending" conversations. Admins can trigger new pairing rounds on-demand.

**Tech Stack:**
- SvelteKit 2 (full-stack framework with SSR)
- TypeScript (strict mode)
- Tailwind CSS 4
- pnpm (package manager)
- Server-Sent Events (SSE) for real-time updates
- In-memory data store (no database in MVP)

## Common Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev             # Start dev server at http://localhost:5173

# Build & Preview
pnpm build           # Build for production
pnpm preview         # Preview production build

# Type Checking
pnpm check           # Run svelte-check once
pnpm check:watch     # Run svelte-check in watch mode
```

## Architecture

### Data Flow
1. **In-Memory Store** (`src/lib/server/store.ts`): All data lives in Map structures. No persistence across restarts.
2. **Event Bus** (`src/lib/server/bus.ts`): Simple pub/sub for broadcasting updates to SSE clients.
3. **SSE Endpoint** (`src/routes/api/events/[eventId]/sse/+server.ts`): Server-Sent Events for real-time updates to clients.
4. **Client Session** (`src/lib/client/session.ts`): localStorage-based session management with 10s heartbeat intervals.

### Pairing Algorithm
The core matching logic (`src/lib/server/pairing.ts`) implements deterministic emoji-based pairing:

1. Each participant gets a unique emoji ID (e.g., 🐶, 🐱)
2. For each round:
   - Compute: `rank = FNV1a32(hashEmoji(emojiId) XOR roundSeed)`
   - Sort participants by rank
   - Pair adjacent entries: `[0,1], [2,3], [4,5]...`
3. **Avoidance window**: Avoid re-pairing people who were matched in the last N rounds (default: 3)
4. **Fallback logic**: If conflicts occur, retry with a new seed (max 5 attempts), then fallback to greedy pairing
5. **Odd handling**: Leave one participant waiting (no trio support in current implementation)

### Real-Time Updates
- Clients connect to `/api/events/{eventId}/sse` for SSE stream
- Server emits events via `emitEvent(eventId, type, payload)` from `bus.ts`
- Events broadcast: `pairings:updated`, `presence:update`
- Clients send heartbeat every 10s via `/api/events/{eventId}/presence`

### Key API Endpoints
- `POST /api/events` - Create new event (admin)
- `POST /api/events/{eventId}/join` - Join event with code, get emoji ID and token
- `GET /api/events/{eventId}/state` - Get event summary (participants, round, presence)
- `POST /api/events/{eventId}/rematch-connected` - Trigger new pairing round (admin only, requires adminKey)
- `GET /api/events/{eventId}/sse` - SSE endpoint for real-time updates
- `POST /api/events/{eventId}/presence` - Heartbeat endpoint (updates lastSeenAt)

### Authentication Model
- **Participants**: Event join code + ephemeral participant token (no passwords)
- **Admins**: Per-event `adminKey` generated on event creation (stored in event object)
- No user accounts, OAuth, or persistent auth

## Important Implementation Details

### Emoji IDs
- Participants get random emoji IDs from a pool of 680+ emojis (see `EMOJIS` array in `store.ts`)
- Each emoji is unique per event
- Emoji hashing uses simple character code summation: `emoji.charCodeAt(i) + ((hash << 5) - hash)`
- Used for deterministic pairing via `hashEmoji(emojiId) XOR roundSeed`

### Presence Detection
- `connected` flag updated via heartbeat POST every 10s
- No automatic disconnect timeout implemented (relies on heartbeat updates)
- Admin dashboard shows real-time presence via SSE updates

### Idempotency
- `rematch-connected` endpoint rejects requests within 1s of previous rematch
- Stored in `event.lastRematch.at` timestamp

### Data Model
Key types in `src/lib/server/types.ts`:
- `Event`: Basic event info + settings + adminKey
- `Participant`: User record with emojiId, token
- `Presence`: Connection status per participant
- `Round`: Round metadata with index and seed
- `Pairing`: Links two participants in a round
- `AvoidanceHistoryEntry`: Tracks last paired round for conflict detection

### SvelteKit Routing
- `src/routes/` - File-based routing
- `+page.svelte` - Page components
- `+server.ts` - API endpoints
- Path aliases: `$lib` → `src/lib`

## Development Notes

- This codebase was built with LLM assistance and may have unconventional patterns
- No tests exist yet
- No persistent database (all in-memory)
- Production deployment uses `@sveltejs/adapter-node` (see `Dockerfile`)
- Presence heartbeats run client-side every 10s; disconnection detection is passive
