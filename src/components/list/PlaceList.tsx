"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchFilteredPlaces, fetchAllPlaces, resolvePlaceFilters } from "@/lib/api/places";
import { fetchTripsBasic } from "@/lib/api/trips";
import { AppEvent } from "@/lib/events";
import { openModal } from "@/lib/url";
import { List, Bookmark, ChevronDown, ChevronUp } from "lucide-react";
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
    <div className="absolute top-4 bottom-4 left-4 right-4 bg-base-100 rounded-lg p-4 shadow-inner overflow-y-auto">
      <h2 className="text-xl font-bold text-base-content mb-4 flex items-center gap-2">
        <List size={20} /> Lista miejsc
      </h2>

      <div className="space-y-4">
        {Object.keys(groupedPlaces).length === 0 ? (
          <p className="text-sm text-base-content/70">Brak miejsc do wyświetlenia.</p>
        ) : (
          Object.entries(groupedPlaces).map(([groupId, groupPlaces]) => {
            const trip = trips[groupId];
            const groupName = trip ? trip.name : "Bez kategorii";
            const groupIcon = trip?.icon || <Bookmark size={16} />;
            const isCollapsed = collapsedGroups.has(groupId);

            return (
              <div key={groupId} className="bg-base-200 rounded-xl shadow-sm border border-base-300 overflow-hidden animate-in fade-in">

                {/* Group Header - Clickable to expand/collapse */}
                <button
                  onClick={() => toggleGroup(groupId)}
                  className="w-full flex items-center justify-between p-3 bg-base-200 hover:bg-base-300 transition-colors text-left border-b border-base-300 cursor-pointer"
                >
                  <div className="flex items-center gap-2 font-bold text-base-content">
                    <span>{groupIcon}</span>
                    <span>{groupName}</span>
                    <span className="text-xs text-muted font-normal ml-1">({groupPlaces.length})</span>
                  </div>
                  <span className="text-muted text-xs flex items-center gap-1">
                    {isCollapsed ? (
                      <>
                        <ChevronDown size={16} /> Rozwiń
                      </>
                    ) : (
                      <>
                        <ChevronUp size={16} /> Zwiń
                      </>
                    )}
                  </span>
                </button>

                {/* Places inside the group */}
                {!isCollapsed && (
                  <div className="p-2 space-y-2">
                    {groupPlaces.map((place) => (
                      <div
                        key={place.id}
                        onClick={() => openModal(router, "view-place", { placeId: place.id })}
                        className="p-3 rounded-lg border border-base-300 hover:border-primary/30 hover:bg-primary/10 cursor-pointer transition-all group"
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-base-content group-hover:text-primary transition-colors">{place.name}</h3>
                          {place.visited && (
                            <span className="text-[10px] font-bold bg-success/20 text-success px-1.5 py-0.5 rounded uppercase shrink-0 ml-2">
                              Odwiedzone
                            </span>
                          )}
                        </div>
                        {place.address && <p className="text-xs text-base-content/70 mt-1 line-clamp-1">{place.address}</p>}
                        {place.note && <p className="text-xs text-muted mt-1 line-clamp-1 italic">&quot;{place.note}&quot;</p>}
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