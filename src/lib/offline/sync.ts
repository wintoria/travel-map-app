// Single, idempotent entry point that wires the mutation queue to connectivity changes. Called once
// from AuthWrapper once a session is confirmed — see that component for why it's gated on auth.
import { onNetworkOnline } from "./network";
import { flushQueue } from "./queue";

let started = false;

export function initSyncListener(): void {
  if (started) return;
  started = true;
  onNetworkOnline(() => {
    flushQueue();
  });
  // Covers the "app reopened already-online with items still queued from a previous offline
  // session" case, not just a live online transition.
  flushQueue();
}

export { flushQueue, getPendingCount } from "./queue";
