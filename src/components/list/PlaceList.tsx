"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchFilteredPlaces, fetchAllPlaces, resolvePlaceFilters } from "@/lib/api/places";
import { fetchTripsBasic } from "@/lib/api/trips";
import { AppEvent } from "@/lib/events";
import { openModal } from "@/lib/url";
import type { Place, Trip } from "@/lib/types";

export default function PlaceList() {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [trips, setTrips] = useState<Record<string, Pick<Trip, "id" | "name" | "icon" | "parent_id">>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Fetch trips to get their names and icons for grouping headers
  const fetchTripsInfo = async () => {
    const data = await fetchTripsBasic();
    const tripsMap = data.reduce((acc, trip) => ({ ...acc, [trip.id]: trip }), {} as Record<string, typeof data[number]>);
    setTrips(tripsMap);
  };

  // Fetch places and apply Sidebar filters (trips, search, and tags)
  const fetchPlaces = async (event?: Event) => {
    setPlaces(await fetchFilteredPlaces(resolvePlaceFilters(event)));
  };

  useEffect(() => {
    // Async fetch-on-mount: setState runs after await, so cascading-render rule is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTripsInfo();
    fetchPlaces();
    // Fire-and-forget: keeps the full offline IndexedDB mirror warm regardless of the active filter.
    void fetchAllPlaces();

    // Listen to changes from Sidebar and Modals
    window.addEventListener(AppEvent.placesUpdated, fetchPlaces);
    window.addEventListener(AppEvent.searchChanged, fetchPlaces as EventListener);
    window.addEventListener(AppEvent.filtersChanged, fetchPlaces);

    return () => {
      window.removeEventListener(AppEvent.placesUpdated, fetchPlaces);
      window.removeEventListener(AppEvent.searchChanged, fetchPlaces as EventListener);
      window.removeEventListener(AppEvent.filtersChanged, fetchPlaces);
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
  }, {} as Record<string, Place[]>);

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
                    {groupPlaces.map((place) => (
                      <div
                        key={place.id}
                        onClick={() => openModal(router, "view-place", { placeId: place.id })}
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
                        {place.note && <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">&quot;{place.note}&quot;</p>}
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