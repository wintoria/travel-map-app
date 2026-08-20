"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-50 flex">
      <Link 
        href={createUrl("map")}
        className={`flex-1 flex justify-center items-center font-medium transition-all ${
          view === "map" ? "text-blue-600 border-t-2 border-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
        }`}>
        🗺️ Mapa
      </Link>
      
      <Link 
        href={createUrl("list")}
        className={`flex-1 flex justify-center items-center font-medium transition-all ${
          view === "list" ? "text-blue-600 border-t-2 border-blue-600 bg-blue-50/50" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
        }`}>
        📋 Lista
      </Link>
    </nav>
  );
}