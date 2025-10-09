# Speed Friending Pair-Up — Design Document

## Goals
- Speed Friending: Web app to pair attendees into 1:1 rounds.
- Admin Control: Dashboard to manage rounds, monitor presence, and rematch all connected participants.
- Real-Time: Live presence and pairing updates (no in-app timers).
- Resilience: Handle joins/leaves, flaky connections, and odd participant counts.

## Non-Goals
- Full Social Network: No profiles, messaging, or long-term friend management.
- Complex Matching Rules: Start with random pairing; advanced constraints are optional extensions.
- Payments/Ticketing: Assume attendees are pre-invited or use a simple join code.

## User Roles
- Participant: Joins an event, gets a Hex ID, optionally sets a display name, sees pairing info.
- Admin: Creates events, triggers pair generation (“Rematch Connected”), manages participants.

## Core Flows
- Join Event:
  - Participant opens event link, enters join code and optional display name.
  - System assigns a short Hex ID (e.g., 2 hex chars like "A3").
  - Lobby shows presence status and event state.
- Presence + Readiness:
  - WebSocket heartbeats mark “connected”; UI shows ready toggle (optional).
- Generate Pairs (Admin):
  - Admin triggers new pair generation; pairs are broadcast instantly.
- During Round (no timer):
  - Participants see partner info and connection status; timing is managed externally.
- End Event:
  - Admin closes event; export summary (optional).

## Admin Dashboard
- Event Control: Open/close registration, broadcast message, generate pairs on demand.
- Presence View: List participants with connection status, last seen, current pair.
- Rematch Controls:
  - Rematch Connected: re-pair all currently connected participants.
  - Rematch All (optional): re-pair everyone regardless of presence.
  - Manual Pairing (optional): drag-and-drop for special cases.
- Moderation: Remove participant, mark as disconnected, block re-entry (optional).

## Matching Rules
- Hex-based deterministic pairing: Each participant has a `hex_id`. For each round, compute a `roundSeed`, derive a rank per participant via a fast hash of (`hex_id` XOR `roundSeed`), sort by rank, and pair adjacent entries. This is deterministic per seed and "CS-y" while remaining uniform.
- No Recent Repeats: Maintain a small history window (e.g., last 3 rounds) to avoid re-pairing same two people. If an adjacent pair would repeat within the window, locally rotate/shift or re-seed and retry up to N attempts.
- Odd Participants: Leave one waiting and prioritize them next round, or allow one trio (configurable).
- Connectivity-aware: Exclude participants without active heartbeats; reconnects are included next round.
- Stability (optional): Prefer minimizing unpaired carry-over across rounds.

## “Rematch Connected” Behavior
- Trigger: Admin clicks “Rematch Connected.”
- Scope: Build a fresh pairing set using only currently connected participants.
- Effect:
  - Ends current pairings immediately (optionally warn/broadcast first).
  - Generates new pairs, respecting “no recent repeats” and odd-count handling.
  - Broadcasts new pairs (no timer reset).
- Safety:
  - Soft-confirm modal if more than N pairs will be interrupted.
  - Disable button during pairing generation to prevent double-trigger.
  - Idempotency key to avoid duplicate rematch within a grace period.

## Data Model
- events: id, name, code, status, current_round_id, settings(json), created_at.
- participants: id, event_id, hex_id, auth_token, created_at.
- presence: participant_id, event_id, connected(bool), last_seen_at, client_info.
- rounds: id, event_id, index, created_at, round_seed(hex or uint32).
- pairings: id, round_id, a_participant_id, b_participant_id, is_trio(bool), c_participant_id(nullable).
- avoidance_history: event_id, p1_id, p2_id, last_paired_round_index.
- admins: id, email, password_hash or SSO_id, role.
- audit_logs: id, event_id, actor(admin_id), action, payload(json), created_at.

Notes:
- Hex ID: Very short, event-unique identifier like 2 hex chars (e.g., “A3”). Default length: 2 for small groups (256 possibilities). System-assigned; retry on collision within an event.
- Keep PII minimal: email only for admin auth.
- Presence can be in-memory with periodic persistence; pairings/rounds persisted.

## Architecture
- Frontend: SPA (React/Vue/Svelte) with WebSocket for real-time; responsive for mobile.
- Backend: Node.js (Express/Fastify/Nest) or similar; WebSocket (Socket.IO/ws).
- DB: PostgreSQL for transactional data; Redis for presence and locks.
- Realtime: WebSocket channels per event; broadcasts for state and pairing updates.
- Deployment: Single-node MVP; scale to multi-instance with sticky sessions or WebSocket broker.

## API (Illustrative)
- POST `/api/events`: create event (admin).
- POST `/api/events/{eventId}/join`: join with `code` and optional `displayName` → returns `participantToken`, `hexId`.
- GET `/api/events/{eventId}/state`: event, round, participants summary.
- POST `/api/events/{eventId}/rematch-connected`: trigger rematch for connected (admin). Creates a new round index and pairings. May accept optional `roundSeed` for determinism.
- GET `/api/events/{eventId}/pairings/current`: current pairings.
- POST `/api/events/{eventId}/participants/{id}/remove`: moderation (admin).

WebSocket events:
- `presence:update`, `pairings:updated`, `round:created` (optional), `admin:broadcast`, `error`.

## Rematch Algorithm (Pseudocode)
```
input:
  connected = participants with presence.connected == true
  hexId(p) = participant hex string (e.g., "A3") -> parseInt(base16)
  history = map[(p1,p2)] -> last paired round index
  roundIndex = current round index
  window = 3  // no-repeat window
  roundSeed = uint32 (provided or generated)

hash32(x): fast 32-bit hash (e.g., FNV-1a or murmur3)

steps:
  # derive deterministic rank per participant from hex and seed
  ranks = [(p, hash32(hexId(p) XOR roundSeed)) for p in connected]
  sort(ranks by rank ascending)

  pairs = []
  waiting = null

  i = 0
  while i < len(ranks):
    if i == len(ranks) - 1:
      waiting = ranks[i].p; break
    a = ranks[i].p
    b = ranks[i+1].p
    last = history.get(sorted_pair(a, b), -inf)
    if roundIndex - last > window:
      pairs.append((a, b))
      i += 2
    else:
      # local adjustment: try swap with next neighbor
      if i + 2 < len(ranks):
        c = ranks[i+2].p
        # try (a,c). If ok, do (a,c) then leave b for next iteration
        last_ac = history.get(sorted_pair(a,c), -inf)
        if roundIndex - last_ac > window:
          pairs.append((a, c))
          # effectively rotate [a,b,c] -> paired(a,c) then b next
          # move b one position forward by swapping ranks[i+1] and ranks[i+2]
          swap(ranks[i+1], ranks[i+2])
          i += 2
          continue
      # if unable to fix locally, abort to re-seed fallback
      pairs = []
      goto fallback

  goto persist

fallback:
  # up to maxRetries, change roundSeed (or shuffle) and retry
  retries = 0; maxRetries = 5
  while retries < maxRetries:
    roundSeed = hash32(roundSeed ^ 0x9E3779B9)  # mix constant
    ranks = [(p, hash32(hexId(p) XOR roundSeed)) for p in connected]
    sort(ranks)
    # re-run pairing loop; if succeeds, break
    if attempt_pair(ranks, history, window, roundIndex) succeeds:
      pairs = result
      break
    retries += 1
  # if still failing, allow minimal repeats to complete pairs
  if pairs is empty:
    ranks = [(p, 0) for p in connected]; sort(ranks by participant id)
    greedy-pair with repeats allowed only when unavoidable

persist:
  # handle leftover
  if count(connected) is odd:
    # option A (default): leave 'waiting' unpaired
    # option B: form trio with the last pair if allowed

  # persist new round, pairs; update avoidance_history; store roundSeed
  # broadcast pairings:updated and round:created (optional)
```

## Presence and Reliability
- Heartbeats: Client pings every 10s; server marks disconnected after 25–30s without ping.
- Reconnect: Resume session by `participantToken`; update presence immediately.
- Debounce: Ignore tiny flaps (e.g., treat as connected if last_seen < 10s).
- Grace Window: Optionally exclude participants who just disconnected seconds ago.

## Security
- Admin Auth: Email/password with session cookies or OAuth; CSRF on admin forms.
- Participant Auth: Event code + ephemeral token; no passwords.
- Authorization: Per-event ACLs; admin endpoints scoped.
- Rate Limiting: Join and broadcast endpoints; WebSocket message size limits.
- Secrets: ENV-managed; no secrets in client.

## UX/UI
- Participant:
  - Join screen: event name, code, connection test.
  - Lobby: ready toggle, presence count, status messages, shows assigned Hex ID.
  - Round view: partner Hex ID prominently; optional display name secondary; reconnect indicator.
  - Waiting view: friendly messages if unpaired.
- Admin:
  - Overview: counts (connected, total, paired).
  - Participants: list with connection status, Hex ID, optional display name, and current pair; search/remove.
  - Controls: Broadcast Message, Rematch Connected.
  - Settings: odd-count handling, avoid-repeat window, confirmation prompts, hex length, deterministic seeding.

## Non-Functional Requirements
- Latency: Pairings visible to clients within <1s after admin action.
- Scale: 500 concurrent participants per event on modest infra; degrade gracefully.
- Availability: Reconnects survive server restarts; state recoverable.
- Observability: Structured logs, metrics for rematch latency, presence counts, errors; alerts on WS disconnect spikes.

## Testing
- Unit: Hex-ID ranking, deterministic pairing given seed, constraint handling, odd counts, no-repeat window.
- Integration: WS presence updates, rematch endpoint lock and idempotency, broadcast delivery.
- E2E: Multi-client session (happy path), mid-round rematch, reconnect behavior.
- Load: Synthetic presence and pairing under concurrent rematch operations.

## Migration/Release Plan
- Milestone 1: Core event creation, join, presence, manual pair generation (deterministic hex-based pairing).
- Milestone 2: Admin dashboard, “Rematch Connected,” no-repeat window, odd handling.
- Milestone 3: Observability, export, moderation, polish UI.

## Open Decisions
- Rematch timing semantics: Immediate vs only when host triggers. Default: immediate on admin action.
- Odd handling: Prefer waiting vs trio. Default: waiting.
- Hex ID length: 2 characters by default (256 possibilities) given small groups; consider 3–4 for larger events.
- Hash choice: FNV-1a vs murmur3 vs xxHash. Default: FNV-1a 32-bit for simplicity.
