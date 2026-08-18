"use client";
import { useEffect, useState } from "react";
import { useMap, Marker, Popup } from "react-leaflet";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import { useRouter } from "next/navigation";
import "leaflet-geosearch/dist/geosearch.css";

export default function MapSearch() {
  // Access the Leaflet map instance
  const map = useMap();
  const router = useRouter();
  const [searchResult, setSearchResult] = useState<any>(null);

  useEffect(() => {
    // Initialize the OpenStreetMap search provider
    const provider = new OpenStreetMapProvider();

    // Configure the search control
    // @ts-ignore
    const searchControl = new GeoSearchControl({
      provider: provider,
      style: "bar",
      showMarker: false, // We disable default marker to use our own clickable one
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      searchLabel: "Szukaj miejsca lub adresu...",
    });

    // Add the control to the map
    map.addControl(searchControl);

    // FIX: Remove annoying browser default tooltips (title) and autocomplete
    setTimeout(() => {
      const inputEl = document.querySelector('.leaflet-control-geosearch input');
      if (inputEl) {
        inputEl.removeAttribute('title');
        inputEl.setAttribute('autocomplete', 'off');
        inputEl.setAttribute('spellcheck', 'false');
      }
    }, 100);

    // Listen for the event when a user selects a place
    map.on("geosearch/showlocation", (result: any) => {
      setSearchResult(result.location);
    });

    // Cleanup function to remove the control when component unmounts
    return () => {
      map.removeControl(searchControl);
      map.off("geosearch/showlocation");
    };
  }, [map]);

  const handlePinClick = () => {
    if (!searchResult) return;
    
    const params = new URLSearchParams(window.location.search);
    params.set("modal", "add-place");
    
    // We pass data to URL, so the modal can read it later
    params.set("lat", searchResult.y);
    params.set("lng", searchResult.x);
    params.set("name", searchResult.label.split(",")[0]); 
    
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (!searchResult) return null;

  // Split the label into parts, trimming extra spaces
  const parts = searchResult.label.split(",").map((p: string) => p.trim());
  const title = parts[0];
  
  // Build subtitle: middle parts + the last part (Country)
  let subtitle = "";
  if (parts.length > 1) {
    const middle = parts.slice(1, 3).join(", ");
    const country = parts[parts.length - 1];
    subtitle = parts.length > 3 ? `${middle}, ${country}` : middle;
  }

  return (
    <Marker position={[searchResult.y, searchResult.x]}>
      <Popup maxWidth={220}>
        <div className="text-center">
          <p className="font-bold text-sm m-0 leading-tight">{title}</p>
          <p className="text-[11px] text-gray-500 mt-1 mb-2 truncate" title={subtitle}>
            {subtitle}
          </p>
          <button 
            onClick={handlePinClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium w-full transition-colors"
          >
            Zapisz to miejsce
          </button>
        </div>
      </Popup>
    </Marker>
  );
}