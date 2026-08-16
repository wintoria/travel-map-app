"use client";
import dynamic from "next/dynamic";

type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  note: string;
};

const MapWidget = dynamic(() => import("@/components/MapWidget"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-500 font-medium">Ładowanie mapy...</p>
    </div>
  ),
});

export default function Map({ places }: { places: Place[] }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-lg shadow-inner overflow-hidden relative">
      <MapWidget places={places} />
    </div>
  );
}