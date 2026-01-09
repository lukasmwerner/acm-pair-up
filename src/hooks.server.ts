import { db } from '$lib/server/store';
import { emitEvent } from '$lib/server/bus';

// Background job: Check for stale connections every 15 seconds
// Mark as disconnected if no heartbeat for 30+ seconds
const HEARTBEAT_TIMEOUT_MS = 30_000;
const CHECK_INTERVAL_MS = 15_000;

setInterval(() => {
	const now = Date.now();
	for (const [participantId, presence] of db.presence.entries()) {
		if (presence.connected && now - presence.lastSeenAt > HEARTBEAT_TIMEOUT_MS) {
			console.log(`[Presence] Timeout disconnect: participant ${participantId}`);
			presence.connected = false;
			try {
				emitEvent(presence.eventId, 'presence:update', {
					participantId,
					connected: false
				});
			} catch (err) {
				console.error('[Presence] Failed to emit disconnect event:', err);
			}
		}
	}
}, CHECK_INTERVAL_MS);

console.log('[Presence] Background timeout detector started (check every 15s, timeout after 30s)');
