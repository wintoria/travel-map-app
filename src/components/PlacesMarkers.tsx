"use client";
import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
  const [places, setPlaces] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Aaccept optional CustomEvent detail object to bypass slow Next.js router URL updates
    const fetchPlaces = async (event?: Event) => {
      const customEventData = (event as CustomEvent)?.detail;
      const tripsParam = customEventData?.trips ?? new URLSearchParams(window.location.search).get("trips");
      const tagsParam = customEventData?.tags ?? new URLSearchParams(window.location.search).get("tags");
      const searchParam = customEventData?.query ?? new URLSearchParams(window.location.search).get("q");
      const isExplicitlyEmpty = customEventData ? customEventData.isEmpty : tripsParam === "none";

      // Stop fetching and clear map only if explicitly unchecked
      if (isExplicitlyEmpty) {
        setPlaces([]);
        return;
      }

      let query = supabase.from("places").select("*").order("created_at", { ascending: false });

      // Apply text search filter across multiple columns
      if (searchParam) {
        query = query.or(`name.ilike.%${searchParam}%,address.ilike.%${searchParam}%,note.ilike.%${searchParam}%`);
      }

      // Filter only if specific folders are checked
      if (tripsParam && tripsParam !== "none") {
        const tripNames = tripsParam.split(",");
        const { data: tripsData } = await supabase.from("trips").select("id, name");
        
        if (tripsData) {
          const tripIds = tripsData.filter(t => tripNames.includes(t.name)).map(t => t.id);
          
          if (tripIds.length === 0) {
            setPlaces([]);
            return;
          }
          query = query.in("trip_id", tripIds);
        }
      }

      // Apply Tags filter
      if (tagsParam) {
        const tagNames = tagsParam.split(",");
        const { data: catData } = await supabase.from("categories").select("id, name");
        if (catData) {
          const tagIds = catData.filter(c => tagNames.includes(c.name)).map(c => c.id);
          if (tagIds.length > 0) {
            // Find places that are linked to any of the selected tags
            const { data: pcData } = await supabase.from("place_categories").select("place_id").in("category_id", tagIds);
            if (pcData && pcData.length > 0) {
              const validPlaceIds = pcData.map(pc => pc.place_id);
              query = query.in("id", validPlaceIds);
            } else {
              // No places match the selected tags
              setPlaces([]);
              return;
            }
          }
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error("Fetch places error:", error);
      } else if (data) {
        setPlaces(data);
      }
    };

    // Initial fetch on mount
    fetchPlaces();

    // Wrapper functions to ensure correct signature for addEventListener
    const handleFiltersChanged = (e: Event) => fetchPlaces(e);
    const handlePlacesUpdated = () => fetchPlaces();

    // Listen for custom events to refresh markers instantly
    window.addEventListener("places-updated", handlePlacesUpdated);
    window.addEventListener("search-changed", fetchPlaces as EventListener);
    window.addEventListener("filters-changed", handleFiltersChanged);
    
    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener("places-updated", handlePlacesUpdated);
      window.removeEventListener("search-changed", fetchPlaces as EventListener);
      window.removeEventListener("filters-changed", handleFiltersChanged);
    };
  }, []);

  // Open details modal and set placeId in URL
  const handleViewDetails = (placeId: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("modal", "view-place");
    params.set("placeId", placeId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (places.length === 0) return null;

  return (
    <>
      {places.map((place) => (
        <Marker key={place.id} position={[place.lat, place.lng]}>
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