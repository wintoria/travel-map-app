"use client";
import dynamic from "next/dynamic";

const MapWidget = dynamic(() => import("@/components/map/MapWidget"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-muted font-medium">Ładowanie mapy...</p>
    </div>
  ),
});

export default function Map() {
  return (
    <div className="flex-1 bg-base-200 rounded-lg shadow-inner overflow-hidden relative">
      <MapWidget />
    </div>
  );
}