"use client";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Popup, AttributionControl, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import MapSearch from "./MapSearch";
import MapClickHandler from "./MapClickHandler";
import PlacesMarkers from "./PlacesMarkers";

// Fix for missing default marker icons in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
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
  const hasCenteredRef = useRef(false);

  // Watch GPS so the dot stays live as the user moves, but only recenter the
  // map once on the initial fix — not on every subsequent update.
  useEffect(() => {
    map.locate({ watch: true, setView: false, maxZoom: 14 });

    map.on("locationfound", (e) => {
      setPosition(e.latlng);
      if (!hasCenteredRef.current) {
        hasCenteredRef.current = true;
        map.setView(e.latlng, map.getZoom());
      }
    });

    // Stop watching and remove the listener on unmount
    return () => {
      map.stopLocate();
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
            fillColor: "#526B55",
            fillOpacity: 1,
            color: "#ffffff",
            weight: 3,
          }}
        >
          <Popup>
            <span className="font-bold text-base-content">Tu jesteś!</span>
          </Popup>
        </CircleMarker>
      )}

      {/* Position top-right */}
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
              if (position) {
                map.setView(position, 14);
              } else {
                map.locate({ watch: true, setView: true, maxZoom: 14 });
              }
            }}
            className="transition-colors !no-underline hover:text-[#526B55]"
            style={{
              width: '34px',
              height: '34px',
              background: '#17201C',
              color: '#F0EDE3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 'normal',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
              <line x1="2" x2="5" y1="12" y2="12" />
              <line x1="19" x2="22" y1="12" y2="12" />
              <line x1="12" x2="12" y1="2" y2="5" />
              <line x1="12" x2="12" y1="19" y2="22" />
              <circle cx="12" cy="12" r="7" />
            </svg>
          </a>
        </div>
      </div>
    </>
  );
}

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