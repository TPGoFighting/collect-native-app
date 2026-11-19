/**
 * Owns cold/warm/hot-start routing for share intents, App Links and notifications.
 * Each native event gets a unique token; duplicate callbacks for the same event
 * are collapsed, but sharing the same URL twice later still navigates again.
 */
export interface IncomingNavigation {
  kind: 'article' | 'recommend';
  value: string;
  source: 'share' | 'link' | 'notification';
  eventId?: string;
}

type Listener = (nav: IncomingNavigation) => void;

let listener: Listener | null = null;
const seenEvents = new Set<string>();

export function setIncomingListener(next: Listener | null): void {
  listener = next;
}

export function dispatchIncoming(nav: IncomingNavigation): void {
  if (nav.eventId) {
    if (seenEvents.has(nav.eventId)) return;
    seenEvents.add(nav.eventId);
    if (seenEvents.size > 32) seenEvents.delete(seenEvents.values().next().value!);
  }
  listener?.(nav);
}
