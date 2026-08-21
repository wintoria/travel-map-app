"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PlaceList() {
  const router = useRouter();
  const [places, setPlaces] = useState<any[]>([]);
  const [trips, setTrips] = useState<Record<string, any>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Fetch trips to get their names and icons for grouping headers
  const fetchTripsInfo = async () => {
    const { data } = await supabase.from("trips").select("id, name, icon");
    if (data) {
      const tripsMap = data.reduce((acc, trip) => ({ ...acc, [trip.id]: trip }), {});
      setTrips(tripsMap);
    }
  };

  // Fetch places and apply Sidebar filters (trips, search, and tags)
  const fetchPlaces = async (event?: Event) => {
    const customEventData = (event as CustomEvent)?.detail;
    const tripsParam = customEventData?.trips ?? new URLSearchParams(window.location.search).get("trips");
    const tagsParam = customEventData?.tags ?? new URLSearchParams(window.location.search).get("tags");
    const searchParam = customEventData?.query ?? new URLSearchParams(window.location.search).get("q");
    const isExplicitlyEmpty = customEventData ? customEventData.isEmpty : tripsParam === "none";

    // Stop if everything is unchecked in the Sidebar
    if (isExplicitlyEmpty) {
      setPlaces([]);
      return;
    }

    let query = supabase.from("places").select("*").order("created_at", { ascending: false });

    // Apply text search filter across multiple columns
    if (searchParam) {
      query = query.or(`name.ilike.%${searchParam}%,address.ilike.%${searchParam}%,note.ilike.%${searchParam}%`);
    }

    // Apply Trip filter
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

    const { data } = await query;
    if (data) setPlaces(data);
  };

  useEffect(() => {
    fetchTripsInfo();
    fetchPlaces();

    // Listen to changes from Sidebar and Modals
    window.addEventListener("places-updated", fetchPlaces);
    window.addEventListener("search-changed", fetchPlaces as EventListener);
    window.addEventListener("filters-changed", fetchPlaces);
    
    return () => {
      window.removeEventListener("places-updated", fetchPlaces);
      window.removeEventListener("search-changed", fetchPlaces as EventListener);
      window.removeEventListener("filters-changed", fetchPlaces);
    };
  }, []);

  // Toggle collapse state for a specific bookmark group
  const toggleGroup = (groupId: string) => {
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    setCollapsedGroups(newSet);
  };

  // Group places by their trip_id
  const groupedPlaces = places.reduce((acc, place) => {
    const groupId = place.trip_id || "uncategorized";
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(place);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="absolute top-4 bottom-4 left-4 right-4 bg-gray-50 rounded-lg p-4 shadow-inner overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Lista miejsc</h2>

      <div className="space-y-4">
        {Object.keys(groupedPlaces).length === 0 ? (
          <p className="text-sm text-gray-500">Brak miejsc do wyświetlenia.</p>
        ) : (
          Object.entries(groupedPlaces).map(([groupId, groupPlaces]) => {
            const trip = trips[groupId];
            const groupName = trip ? trip.name : "Bez kategorii";
            const groupIcon = trip?.icon || "🔖";
            const isCollapsed = collapsedGroups.has(groupId);

            return (
              <div key={groupId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in">
                
                {/* Group Header - Clickable to expand/collapse */}
                <button
                  onClick={() => toggleGroup(groupId)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left border-b border-gray-100 cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-gray-800">
                    <span>{groupIcon}</span>
                    <span>{groupName}</span>
                    <span className="text-xs text-gray-400 font-normal ml-1">({groupPlaces.length})</span>
                  </div>
                  <span className="text-gray-400 text-xs">{isCollapsed ? "▼ Rozwiń" : "▲ Zwiń"}</span>
                </button>

                {/* Places inside the group */}
                {!isCollapsed && (
                  <div className="p-2 space-y-2">
                    {groupPlaces.map((place: any) => (
                      <div
                        key={place.id}
                        onClick={() => {
                          // Open View Details Modal
                          const params = new URLSearchParams(window.location.search);
                          params.set("modal", "view-place");
                          params.set("placeId", place.id);
                          router.push(`?${params.toString()}`, { scroll: false });
                        }}
                        className="p-3 rounded-lg border border-gray-50 hover:border-blue-100 hover:bg-blue-50/50 cursor-pointer transition-all group"
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{place.name}</h3>
                          {place.visited && (
                            <span className="text-[10px] font-bold bg-green-100 text-green-800 px-1.5 py-0.5 rounded uppercase shrink-0 ml-2">
                              Odwiedzone
                            </span>
                          )}
                        </div>
                        {place.address && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{place.address}</p>}
                        {place.note && <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">"{place.note}"</p>}
                      </div>
                    ))}
                  </div>
                )}
                
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}