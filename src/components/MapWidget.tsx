"use client";
import { MapContainer, TileLayer, Marker, Popup, AttributionControl } from "react-leaflet";
import L from "leaflet";
import MapSearch from "./MapSearch";

// Fix for missing default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  note: string;
};

export default function MapWidget({ places }: { places: Place[] }) {
  // Coordinates for Szczecin
  const position: [number, number] = [53.4285, 14.5528];

  return (
    <MapContainer 
      center={position} 
      zoom={13} 
      className="absolute inset-0 z-0"
      attributionControl={false}
    >
      <AttributionControl prefix='<a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>' />
      <MapSearch />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* Render database pins */}
      {places.map((place) => (
        <Marker key={place.id} position={[place.lat, place.lng]}>
          <Popup>
            <strong>{place.name}</strong> <br />
            {place.note}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}