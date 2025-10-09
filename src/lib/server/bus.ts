type Handler = (data: unknown) => void;

class Emitter {
  private listeners = new Map<string, Set<Handler>>();
  on(event: string, cb: Handler) {
    const set = this.listeners.get(event) ?? new Set<Handler>();
    set.add(cb);
    this.listeners.set(event, set);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.off(event, cb);
    };
  }
  off(event: string, cb: Handler) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(cb);
  }
  emit(event: string, data: unknown) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) cb(data);
  }
}

export const bus = new Emitter();

export function emitEvent(eventId: string, type: string, payload: unknown) {
  bus.emit(`event:${eventId}`, { type, payload, ts: Date.now() });
}
