"use client";
import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { useRouter } from "next/navigation";
import { fetchFilteredPlaces, resolvePlaceFilters } from "@/lib/api/places";
import { AppEvent } from "@/lib/events";
import { openModal } from "@/lib/url";
import type { Place } from "@/lib/types";

// Format long addresses into shorter format (Street, City, Country)
const formatAddress = (address: string) => {
  if (!address) return "";
  const parts = address.split(",").map(p => p.trim());
  if (parts.length <= 3) return address;

  // Filter out postal codes (e.g., 70-527) and regions (e.g., województwo)
  const filtered = parts.filter(p => !p.match(/\d{2}-\d{3}/) && !p.toLowerCase().includes("województwo"));

  if (filtered.length >= 3) {
    // Return first part (Street), second to last (City), and last (Country)
    return `${filtered[0]}, ${filtered[filtered.length - 2]}, ${filtered[filtered.length - 1]}`;
  }

  return filtered.join(", ");
};

export default function PlacesMarkers() {
  const [places, setPlaces] = useState<Place[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Accept optional CustomEvent detail object to bypass slow Next.js router URL updates
    const fetchPlaces = async (event?: Event) => {
      setPlaces(await fetchFilteredPlaces(resolvePlaceFilters(event)));
    };

    // Initial fetch on mount
    fetchPlaces();

    // Wrapper functions to ensure correct signature for addEventListener
    const handleFiltersChanged = (e: Event) => fetchPlaces(e);
    const handlePlacesUpdated = () => fetchPlaces();

    // Listen for custom events to refresh markers instantly
    window.addEventListener(AppEvent.placesUpdated, handlePlacesUpdated);
    window.addEventListener(AppEvent.searchChanged, fetchPlaces as EventListener);
    window.addEventListener(AppEvent.filtersChanged, handleFiltersChanged);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener(AppEvent.placesUpdated, handlePlacesUpdated);
      window.removeEventListener(AppEvent.searchChanged, fetchPlaces as EventListener);
      window.removeEventListener(AppEvent.filtersChanged, handleFiltersChanged);
    };
  }, []);

  // Open details modal and set placeId in URL
  const handleViewDetails = (placeId: string) => openModal(router, "view-place", { placeId });

  if (places.length === 0) return null;

  return (
    <>
      {places.map((place) => (
        <Marker key={place.id} position={[place.lat!, place.lng!]}>
          {/* minWidth ensures the 'X' close button doesn't overlap short titles */}
          <Popup minWidth={150} maxWidth={250}>
            <div className="text-center pb-1">
              
              {/* Clickable title (Button disguised as header) */}
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleViewDetails(place.id);
                }}
                className="font-bold text-sm m-0 leading-tight mt-1 text-gray-800 hover:text-gray-500 !no-underline transition-colors cursor-pointer w-full text-center border-none bg-transparent"
              >
                {place.name}
              </button>
              
              {/* Address display (Passed through formatter) */}
              {place.address && (
                <p className="text-[11px] text-gray-500 mt-1 mb-2">
                  {formatAddress(place.address)}
                </p>
              )}
              
              {/* Styled note display */}
              {place.note && (
                <p className="text-xs text-gray-700 mt-2 mb-2 italic border-l-2 border-blue-500 pl-2 text-left">
                  {place.note}
                </p>
              )}
              
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}