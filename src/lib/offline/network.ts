"use client";
import { useEffect, useState } from "react";

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
