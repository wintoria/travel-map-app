"use client";
import { useEffect, useState, useRef } from "react";
import { useMap, Marker, Popup } from "react-leaflet";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import { useRouter } from "next/navigation";
import "leaflet-geosearch/dist/geosearch.css";

export default function MapSearch() {
  // Access the Leaflet map instance
  const map = useMap();
  const router = useRouter();
  // Ref to programmatically control the popup
  const markerRef = useRef<any>(null);
  const [searchResult, setSearchResult] = useState<any>(null);

  useEffect(() => {
    // Initialize the OpenStreetMap search provider
    const provider = new OpenStreetMapProvider();

    // Configure the search control
    // @ts-ignore
    const searchControl = new GeoSearchControl({
      provider: provider,
      style: "bar",
      showMarker: false,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      searchLabel: "Szukaj miejsca lub adresu...",
    });

    // Add the control to the map
    map.addControl(searchControl);

    setTimeout(() => {
      const inputEl = document.querySelector('.leaflet-control-geosearch input');
      if (inputEl) {
        inputEl.removeAttribute('title');
        inputEl.setAttribute('autocomplete', 'off');
        inputEl.setAttribute('spellcheck', 'false');
      }
    }, 100);

    // Listen for the event when a user selects a place
    const handleLocation = (result: any) => {
      // Force coordinates to be numbers (Nominatim sometimes returns strings)
      const safeLocation = {
        ...result.location,
        x: parseFloat(result.location.x),
        y: parseFloat(result.location.y)
      };
      setSearchResult(safeLocation);
    };

    // Hide search pin if user clicks somewhere else on the map (prevent dual pins)
    const handleMapClick = () => setSearchResult(null);

    map.on("geosearch/showlocation", handleLocation);
    map.on("click", handleMapClick);

    // Cleanup function to remove the control when component unmounts
    return () => {
      map.removeControl(searchControl);
      map.off("geosearch/showlocation", handleLocation);
      map.off("click", handleMapClick);
    };
  }, [map]);

  // Automatically open the popup when the search pin is placed
  useEffect(() => {
    if (searchResult && markerRef.current) {
      setTimeout(() => {
        if (markerRef.current) markerRef.current.openPopup();
      }, 600);
    }
  }, [searchResult]);

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent map click from passing through
    if (!searchResult) return;
    
    const params = new URLSearchParams(window.location.search);
    params.set("modal", "add-place");
    params.set("lat", searchResult.y);
    params.set("lng", searchResult.x);
    
    // Pass the name, the full address, and the flag to lock the name field
    params.set("name", searchResult.label.split(",")[0]); 
    params.set("address", searchResult.label);
    params.set("lockedName", "true"); 
    
    router.push(`?${params.toString()}`, { scroll: false });
    setSearchResult(null); // Remove search pin after opening modal
  };

  if (!searchResult) return null;

  const parts = searchResult.label.split(",").map((p: string) => p.trim());
  const title = parts[0];
  
  let subtitle = "";
  if (parts.length > 1) {
    const middle = parts.slice(1, 3).join(", ");
    const country = parts[parts.length - 1];
    subtitle = parts.length > 3 ? `${middle}, ${country}` : middle;
  }

  return (
    <Marker position={[searchResult.y, searchResult.x]} ref={markerRef}>
      <Popup maxWidth={220}>
        <div className="text-center">
          <p className="font-bold text-sm m-0 leading-tight mt-1">{title}</p>
          <p className="text-[11px] text-gray-500 mt-1 mb-2 truncate" title={subtitle}>
            {subtitle}
          </p>
          
          {/* Action buttons wrapper */}
          <div className="flex gap-2 mt-2 relative z-10">
            {/* Cancel/Deselect button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSearchResult(null); // Remove temporary pin
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium flex-1 transition-colors cursor-pointer"
            >
              Odznacz
            </button>

            {/* Save button */}
            <button 
              onClick={handlePinClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex-1 transition-colors cursor-pointer"
            >
              Zapisz
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}