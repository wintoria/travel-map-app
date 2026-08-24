"use client";
import { useEffect, useMemo, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { fetchFilteredPlaces, fetchAllPlaces, fetchAllPlaceCategories, resolvePlaceFilters } from "@/lib/api/places";
import { fetchCategories } from "@/lib/api/categories";
import { fetchTripsBasic } from "@/lib/api/trips";
import { autoColorForEmoji, DEFAULT_MARKER_EMOJI } from "@/lib/color";
import { AppEvent } from "@/lib/events";
import { openModal } from "@/lib/url";
import type { Category, Place, PlaceCategory, Trip } from "@/lib/types";

// Emoji-on-circle marker icon. Built via DOM APIs (not an HTML template string) so emoji/icon text
// from user-editable category/trip data is always escaped, never interpreted as markup. Circle color
// comes from autoColorForEmoji, which is always one of our own curated hex constants.
function buildEmojiIcon(emoji: string, color: string): L.DivIcon {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,0.4);border:2px solid #fff;background:${color};`;
  wrapper.textContent = emoji;
  return L.divIcon({
    className: "",
    html: wrapper.outerHTML,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -14],
  });
}

// Priority: place's main-tag emoji (alphabetically first if it has several) -> trip's tab emoji ->
// default landmark pin. Pure lookup (no Leaflet objects) so it's cheap to recompute for a signature.
function resolveMarkerEmoji(
  place: Place,
  categoriesById: Map<string, Category>,
  categoryIdsByPlace: Map<string, string[]>,
  tripIconById: Map<string, string | null>
): string {
  const mainCats = (categoryIdsByPlace.get(place.id) || [])
    .map((id) => categoriesById.get(id))
    .filter((c): c is Category => !!c && c.is_main && !!c.icon)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (mainCats.length > 0) return mainCats[0].icon!;

  const tripIcon = place.trip_id ? tripIconById.get(place.trip_id) : null;
  return tripIcon || DEFAULT_MARKER_EMOJI;
}

interface MarkerVisual {
  icon: L.DivIcon;
  // Included in the Marker's React `key` so a changed icon unmounts/remounts the Leaflet marker
  // instead of going through react-leaflet's setIcon() update path, which crashes with
  // "Cannot read properties of undefined (reading 'createIcon')" under React 19 Strict Mode's
  // dev mount/unmount/remount cycle.
  signature: string;
}

function resolveMarkerVisual(
  place: Place,
  categoriesById: Map<string, Category>,
  categoryIdsByPlace: Map<string, string[]>,
  tripIconById: Map<string, string | null>
): MarkerVisual {
  const emoji = resolveMarkerEmoji(place, categoriesById, categoryIdsByPlace, tripIconById);
  const color = autoColorForEmoji(emoji);
  return { icon: buildEmojiIcon(emoji, color), signature: `${emoji}|${color}` };
}

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [placeCategories, setPlaceCategories] = useState<PlaceCategory[]>([]);
  const [trips, setTrips] = useState<Pick<Trip, "id" | "icon">[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Accept optional CustomEvent detail object to bypass slow Next.js router URL updates
    const fetchPlaces = async (event?: Event) => {
      setPlaces(await fetchFilteredPlaces(resolvePlaceFilters(event)));
    };

    // Backs the emoji-marker lookup: which category is "main", which categories a place has, and
    // each trip's tab icon (fallback when a place has no main-tagged category).
    const fetchIconData = async () => {
      const [cats, pcs, tps] = await Promise.all([fetchCategories(), fetchAllPlaceCategories(), fetchTripsBasic()]);
      setCategories(cats);
      setPlaceCategories(pcs);
      setTrips(tps);
    };

    // Initial fetch on mount
    fetchPlaces();
    fetchIconData();
    // Fire-and-forget: keeps the full offline IndexedDB mirror warm regardless of the active filter.
    void fetchAllPlaces();

    // Wrapper functions to ensure correct signature for addEventListener
    const handleFiltersChanged = (e: Event) => fetchPlaces(e);
    const handlePlacesUpdated = () => {
      fetchPlaces();
      fetchIconData(); // a place's own tag assignments may have changed
    };
    const handleIconDataUpdated = () => fetchIconData();

    // Listen for custom events to refresh markers instantly
    window.addEventListener(AppEvent.placesUpdated, handlePlacesUpdated);
    window.addEventListener(AppEvent.searchChanged, fetchPlaces as EventListener);
    window.addEventListener(AppEvent.filtersChanged, handleFiltersChanged);
    window.addEventListener(AppEvent.categoriesUpdated, handleIconDataUpdated);
    window.addEventListener(AppEvent.tripsUpdated, handleIconDataUpdated);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener(AppEvent.placesUpdated, handlePlacesUpdated);
      window.removeEventListener(AppEvent.searchChanged, fetchPlaces as EventListener);
      window.removeEventListener(AppEvent.filtersChanged, handleFiltersChanged);
      window.removeEventListener(AppEvent.categoriesUpdated, handleIconDataUpdated);
      window.removeEventListener(AppEvent.tripsUpdated, handleIconDataUpdated);
    };
  }, []);

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categoryIdsByPlace = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pc of placeCategories) {
      const ids = map.get(pc.place_id) ?? [];
      ids.push(pc.category_id);
      map.set(pc.place_id, ids);
    }
    return map;
  }, [placeCategories]);
  const tripIconById = useMemo(() => new Map(trips.map((t) => [t.id, t.icon])), [trips]);
  // Memoized per place so the icon object identity stays stable across unrelated re-renders.
  const markerVisuals = useMemo(
    () => new Map(places.map((p) => [p.id, resolveMarkerVisual(p, categoriesById, categoryIdsByPlace, tripIconById)])),
    [places, categoriesById, categoryIdsByPlace, tripIconById]
  );

  // Open details modal and set placeId in URL
  const handleViewDetails = (placeId: string) => openModal(router, "view-place", { placeId });

  if (places.length === 0) return null;

  return (
    <>
      {places.map((place) => {
        const visual = markerVisuals.get(place.id)!;
        return (
        <Marker
          key={`${place.id}:${visual.signature}`}
          position={[place.lat!, place.lng!]}
          icon={visual.icon}
        >
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
        );
      })}
    </>
  );
}