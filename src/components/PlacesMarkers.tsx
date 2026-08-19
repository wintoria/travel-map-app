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
      // Fetch all places from the database
      const { data, error } = await supabase
        .from("places")
        .select("*");

      if (error) {
        console.error("Fetch places error:", error);
      } else if (data) {
        setPlaces(data);
      }
    };

    fetchPlaces();

    // Listen for custom event to refresh markers instantly after save/delete
    window.addEventListener("places-updated", fetchPlaces);
    
    // Cleanup listener on unmount
    return () => window.removeEventListener("places-updated", fetchPlaces);
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
          <Popup maxWidth={250}>
            <div className="text-center pb-1">
              
              {/* Clickable title (Button disguised as header) */}
              <button 
                onClick={() => handleViewDetails(place.id)}
                className="font-bold text-sm m-0 leading-tight mt-1 text-gray-800 hover:text-gray-500 !no-underline transition-colors cursor-pointer w-full text-center border-none bg-transparent"
              >
                {place.name}
              </button>
              
              {/* Address display */}
              {place.address && (
                <p className="text-[11px] text-gray-500 mt-1 mb-2">
                  {place.address}
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