"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
        <span className="bg-warning/20 text-warning border border-warning/40 px-2 py-1 rounded-full">
          Offline
        </span>
      )}
      {pending > 0 && (
        <span className="flex items-center gap-1 bg-info/20 text-info border border-info/30 px-2 py-1 rounded-full">
          <Loader2 size={14} className="animate-spin" /> {pending} do synchronizacji
        </span>
      )}
    </div>
  );
}
