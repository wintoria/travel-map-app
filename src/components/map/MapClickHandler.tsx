"use client";
import { useState, useRef, useEffect } from "react";
import { useMapEvents, Marker, Popup } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { useRouter, useSearchParams } from "next/navigation";
import { openModal } from "@/lib/url";

export default function MapClickHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const markerRef = useRef<LeafletMarker>(null);

  // State to hold the clicked location and fetched data
  const [clickData, setClickData] = useState<{lat: number, lng: number, name: string, address: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dropPinAt = async (lat: number, lng: number) => {
    // Do nothing if a modal is already open
    if (searchParams.get("modal")) return;

    // Place a temporary pin and show loading state
    setClickData({ lat, lng, name: "", address: "Pobieranie adresu..." });
    setIsLoading(true);

    try {
      // Reverse Geocoding: Ask OpenStreetMap what is at these coordinates
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();

      // Try to extract a logical POI name (if it exists)
      let placeName = "";
      if (data.name) {
        placeName = data.name;
      } else if (data.address) {
        placeName = data.address.amenity || data.address.tourism || data.address.shop || data.address.building || "";
      }

      // Get the full display address
      const address = data.display_name || "";

      // Update the pin with real data
      setClickData({ lat, lng, name: placeName, address });
    } catch (error) {
      console.error("Geocoding error:", error);
      setClickData({ lat, lng, name: "", address: "Nie udało się pobrać adresu." });
    } finally {
      setIsLoading(false);
    }
  };

  // Hook into map events and get the map instance. Leaflet only fires "click" for a genuine
  // tap/click — it's suppressed automatically after a drag/pan, so no manual drag-detection needed.
  const map = useMapEvents({
    click(e) {
      if (searchParams.get("modal")) return;
      dropPinAt(e.latlng.lat, e.latlng.lng);
    },
  });

  // Automatically open the popup when the pin is placed or updated
  useEffect(() => {
    if (clickData && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [clickData]);

  // Hide this clicked pin if user uses the search bar (prevent dual pins)
  useEffect(() => {
    const handleSearch = () => setClickData(null);
    map.on("geosearch/showlocation", handleSearch);
    return () => {
      map.off("geosearch/showlocation", handleSearch);
    };
  }, [map]);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent click from passing through to the map (prevents placing a new pin underneath)
    if (!clickData) return;
    
    const extra: Record<string, string> = {
      lat: clickData.lat.toFixed(6),
      lng: clickData.lng.toFixed(6),
    };
    if (clickData.name) extra.name = clickData.name;
    if (clickData.address) extra.address = clickData.address;

    openModal(router, "add-place", extra);
    setClickData(null); // Hide the pin once modal opens
  };

  if (!clickData) return null;

  return (
    <Marker position={[clickData.lat, clickData.lng]} ref={markerRef}>
      <Popup maxWidth={220}>
        <div className="text-center pb-1">
          {isLoading ? (
            <p className="text-sm text-muted mb-3 mt-1">Szukanie miejsca...</p>
          ) : (
            <>
              <p className="font-bold text-sm m-0 leading-tight mt-1">
                {clickData.name || "Wybrane miejsce"}
              </p>
              <p className="text-[11px] text-muted mt-1 mb-2 truncate" title={clickData.address}>
                {clickData.address || `${clickData.lat.toFixed(4)}, ${clickData.lng.toFixed(4)}`}
              </p>
            </>
          )}
          
          {/* Action buttons wrapper */}
          <div className="flex gap-2 mt-2 relative z-10">
            {/* Cancel/Deselect button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setClickData(null); // Remove temporary pin
              }}
              className="bg-base-300 hover:bg-base-300/70 text-base-content px-3 py-1.5 rounded-lg text-sm font-medium flex-1 transition-colors cursor-pointer"
            >
              Odznacz
            </button>

            {/* Save button */}
            <button
              onClick={handleSaveClick}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-content px-3 py-1.5 rounded-lg text-sm font-medium flex-1 transition-colors disabled:bg-primary/40 cursor-pointer"
            >
              Zapisz
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}