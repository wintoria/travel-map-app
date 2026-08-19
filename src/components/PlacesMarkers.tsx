"use client";
import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PlacesMarkers() {
  const [places, setPlaces] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchPlaces = async () => {
      // Fetch places and force fresh data by appending a unique timestamp
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .neq("id", `cache-bust-${Date.now()}`);

      if (!error && data) setPlaces(data);
    };

    fetchPlaces();

    // Listen for custom event to refresh markers without page reload
    window.addEventListener("places-updated", fetchPlaces);
    
    // Cleanup listener
    return () => window.removeEventListener("places-updated", fetchPlaces);
  }, []);

  // Update URL to open the details modal for a specific place
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
          <Popup maxWidth={250}>
            <div className="text-center pb-1">
              {/* Invisible button styled as a standard header */}
              <button 
                onClick={() => handleViewDetails(place.id)}
                className="font-bold text-sm m-0 leading-tight mt-1 text-gray-900 hover:text-gray-500 transition-colors cursor-pointer w-full text-center"
              >
                {place.name}
              </button>
              
              {place.address && (
                <p className="text-[11px] text-gray-500 mt-1 mb-2">
                  {place.address}
                </p>
              )}
              
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