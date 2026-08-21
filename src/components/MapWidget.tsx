"use client";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, AttributionControl, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import MapSearch from "./MapSearch";
import MapClickHandler from "./MapClickHandler";
import PlacesMarkers from "./PlacesMarkers";

// Fix for missing default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Component for the GPS location button and user location marker
function LocateControl() {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement>(null);
  
  // State to hold the exact user coordinates
  const [position, setPosition] = useState<L.LatLng | null>(null);

  // Center map on user location on initial load and listen for location
  useEffect(() => {
    map.locate({ setView: true, maxZoom: 14 });

    // When location is found, save it to state
    map.on("locationfound", (e) => {
      setPosition(e.latlng);
    });

    // Cleanup listener on unmount
    return () => {
      map.off("locationfound");
    };
  }, [map]);

  // Prevent map clicks/zooming when interacting with the button
  useEffect(() => {
    if (controlRef.current) {
      L.DomEvent.disableClickPropagation(controlRef.current);
      L.DomEvent.disableScrollPropagation(controlRef.current);
    }
  }, []);

  return (
    <>
      {/* Blue dot showing exact current GPS location */}
      {position && (
        <CircleMarker
          center={position}
          radius={8}
          pathOptions={{
            fillColor: "#3b82f6",
            fillOpacity: 1,
            color: "#ffffff",
            weight: 3,
          }}
        >
          <Popup>
            <span className="font-bold text-gray-800">Tu jesteś!</span>
          </Popup>
        </CircleMarker>
      )}

      // Position top-right
      <div className="leaflet-top leaflet-right">
        <div 
          ref={controlRef}
          className="leaflet-control leaflet-bar shadow-md"
          style={{ marginTop: '10px', marginRight: '10px' }}
        >
          <a 
            href="#" 
            role="button" 
            title="Moja lokalizacja"
            onClick={(e) => {
              e.preventDefault();
              map.locate({ setView: true, maxZoom: 14 });
            }}
            className="flex items-center justify-center text-xl bg-white text-gray-700 hover:text-blue-600 transition-colors !no-underline"
            style={{ width: '34px', height: '34px' }}
          >
            🎯
          </a>
        </div>
      </div>
    </>
  );
}

type Place = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  note: string;
};

export default function MapWidget() {
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
      <MapClickHandler />
      <PlacesMarkers />
      <LocateControl />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}