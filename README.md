# ACM Pair-Up

A real-time speed friending web app for pairing attendees into 1:1 rounds at events.

> [!WARNING]
> This code was programmed with LLMs, largely without supervision.

## What is this?

ACM Pair-Up helps event organizers run "speed friending" sessions where participants get randomly paired for one-on-one conversations. Think speed dating, but for making friends or networking.

**For Participants:**
- Join an event with a simple code
- Get assigned a unique emoji ID (like 🐶 or 🎸)
- Automatically paired with other participants each round
- See your current partner's emoji in real-time
- No signup or account required

**For Admins:**
- Create events and share the join code
- See all participants and their connection status in real-time
- Click "Rematch Connected" to instantly create new pairings
- Smart algorithm avoids re-pairing the same people too soon

## Key Features

- **Real-time updates** via Server-Sent Events (SSE) - no page refreshes needed
- **Smart pairing algorithm** - deterministic emoji-based matching with conflict avoidance
- **Presence tracking** - automatic heartbeats show who's currently connected
- **No database** - fully in-memory MVP for simplicity
- **Mobile-friendly** - responsive design with Tailwind CSS

## How It Works

### The Pairing Algorithm

Each round, the app:
1. Takes all connected participants with their emoji IDs
2. Computes a deterministic rank: `FNV1a32(hashEmoji(emojiId) XOR roundSeed)`
3. Sorts by rank and pairs adjacent people: [0,1], [2,3], [4,5]...
4. Avoids re-pairing people who were matched in the last 3 rounds
5. Handles odd numbers by leaving one person waiting (prioritized next round)

This creates fair, pseudo-random pairings that feel fresh each round while avoiding recent repeats.

### Tech Stack

- **SvelteKit 2** - Full-stack framework with SSR
- **TypeScript** - Strict mode for type safety
- **Tailwind CSS 4** - Utility-first styling
- **Server-Sent Events** - Real-time updates without WebSockets
- **Node.js** - Production deployment with adapter-node

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
# Open http://localhost:5173

# Build for production
pnpm build
pnpm preview
```

## Usage

### Creating an Event

1. Visit the admin page
2. Create a new event with a name and join code
3. Share the event link and code with participants

### Joining as a Participant

1. Go to the event URL
2. Enter the join code
3. Get assigned your emoji ID
4. Wait for the admin to start pairing rounds

### Running Rounds

1. Admin clicks "Rematch Connected" when ready
2. All connected participants instantly see their new partner
3. Participants chat for the designated time (managed externally)
4. Admin triggers next round when ready

## Architecture Highlights

- **In-memory store** - All data in JavaScript Maps (no persistence)
- **Event bus** - Simple pub/sub for broadcasting to SSE clients
- **Emoji-based IDs** - 680+ emoji pool ensures uniqueness and personality
- **Presence heartbeat** - Clients ping every 10s to maintain connection status
- **Idempotency** - Prevents duplicate rematch requests within 1 second

See [DESIGN.md](./DESIGN.md) for detailed architecture and [CLAUDE.md](./CLAUDE.md) for development guidance.

## Deployment

The app includes a `Dockerfile` and `fly.toml` for deployment to Fly.io:

```bash
fly deploy
```

**Note:** Since data is in-memory, all events/participants are lost on restart. For production use, implement persistent storage.

## License

MIT License - see [LICENSE](./LICENSE) for details.

This means you're free to use, modify, and distribute this code for any purpose, including commercial use.
