"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Map, List } from "lucide-react";

export default function BottomNav() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "map";
  // Helper function to keep current URL params (like search or filters)
  const createUrl = (newView: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    return `?${params.toString()}`;
  };
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-base-200 border-t border-base-300 z-50 flex">
      <Link
        href={createUrl("map")}
        className={`flex-1 flex justify-center items-center gap-1.5 font-medium transition-all ${
          view === "map" ? "text-primary border-t-2 border-primary bg-primary/10" : "text-base-content/70 hover:text-base-content hover:bg-base-300"
        }`}>
        <Map size={20} /> Mapa
      </Link>

      <Link
        href={createUrl("list")}
        className={`flex-1 flex justify-center items-center gap-1.5 font-medium transition-all ${
          view === "list" ? "text-primary border-t-2 border-primary bg-primary/10" : "text-base-content/70 hover:text-base-content hover:bg-base-300"
        }`}>
        <List size={20} /> Lista
      </Link>
    </nav>
  );
}