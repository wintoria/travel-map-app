"use client";
import { useEffect, useState } from "react";

// Quick upfront check so offline-aware reads can skip the network attempt entirely and go straight
// to the IndexedDB cache — instant instead of waiting on a fetch that's going to fail anyway.
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

// Shown after a create/update that got queued instead of applied live (the mutation's returned row
// carries `_pendingSync: true` in that case) — tells the user their edit is safe, not lost.
export const PENDING_SYNC_MESSAGE =
  "Jesteś offline — zmiana została zapisana lokalnie i zsynchronizuje się automatycznie, gdy wrócisz do sieci.";

// Supabase (postgrest-js and storage-js) does NOT throw on a network failure by default — it resolves
// with `{ data: null, error }` where `error` wraps the underlying fetch TypeError (postgrest-js also
// sets `status: 0`). This checks that error shape (plus a live navigator.onLine read) to distinguish a
// connectivity failure from a real server error (RLS/validation), which should propagate as-is.
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: unknown }).name) : "";
  if (name === "StorageUnknownError") return true;
  const message = "message" in err ? String((err as { message?: unknown }).message) : "";
  return /failed to fetch|load failed|typeerror|networkerror/i.test(message);
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}

export function onNetworkOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  return () => window.removeEventListener("online", cb);
}
