export type Session = {
  eventId: string;
  participantToken?: string;
  participantId?: string;
  emojiId?: string;
  emojiName?: string;
  adminKey?: string;
};

const KEY = 'sf_session_v1';

export function loadSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function saveSession(s: Session) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function clearSession() { localStorage.removeItem(KEY); }

export async function heartbeat(eventId: string, participantToken: string) {
  await fetch(`/api/events/${eventId}/presence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantToken }) });
}

export function startHeartbeat(eventId: string, participantToken: string) {
  heartbeat(eventId, participantToken).catch(()=>{});
  const id = setInterval(() => heartbeat(eventId, participantToken).catch(()=>{}), 10_000);
  return () => clearInterval(id);
}

export function connectSSE(eventId: string, onMessage: (msg: any) => void) {
  const es = new EventSource(`/api/events/${eventId}/sse`);
  es.onmessage = (ev) => { try { onMessage(JSON.parse(ev.data)); } catch {} };
  return () => es.close();
}
