"use client";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/lib/offline/network";
import { getPendingCount } from "@/lib/offline/sync";
import { AppEvent } from "@/lib/events";

export default function SyncStatusIndicator() {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () => {
      getPendingCount().then(setPending);
    };
    refresh();

    window.addEventListener(AppEvent.syncQueueChanged, refresh);
    return () => window.removeEventListener(AppEvent.syncQueueChanged, refresh);
  }, []);

  if (isOnline && pending === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shrink-0 mr-2">
      {!isOnline && (
        <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-full">
          Offline
        </span>
      )}
      {pending > 0 && (
        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
          ⏳ {pending} do synchronizacji
        </span>
      )}
    </div>
  );
}
