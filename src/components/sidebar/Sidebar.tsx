"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { OpenStreetMapProvider } from "leaflet-geosearch"
import { fetchTrips } from "@/lib/api/trips";
import { fetchCategories } from "@/lib/api/categories";
import { fetchPendingPlaces as loadPendingPlaces, deletePlace, updatePlaceCoords } from "@/lib/api/places";
import { getAllDescendants } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { currentParams, openModal, pushParams } from "@/lib/url";
import type { Category, Place, Trip } from "@/lib/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type PendingPlace = Pick<Place, "id" | "name" | "note">;

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();

  // Data states
  const [trips, setTrips] = useState<Trip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // State for places missing coordinates
  const [pendingPlaces, setPendingPlaces] = useState<PendingPlace[]>([]);
  // State to track which place is currently showing the delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Accordion states for UI sections
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isTripsOpen, setIsTripsOpen] = useState(true);
  const [isTagsOpen, setIsTagsOpen] = useState(false);

  // Fetch pending places (separated so it can be re-used by the event listener)
  const fetchPendingPlaces = async () => {
    setPendingPlaces(await loadPendingPlaces());
  };

  // State to track the batch geocoding progress
  const [geocodeProgress, setGeocodeProgress] = useState({ 
    isRunning: false, current: 0, total: 0, found: 0 
  });
  
  // State for the beautiful inline summary message
  const [geocodeSummary, setGeocodeSummary] = useState<string | null>(null);

  // Batch process to find coordinates for pending places
  const handleBatchGeocode = async () => {
    if (geocodeProgress.isRunning || pendingPlaces.length === 0) return;
    
    setGeocodeSummary(null); // Clear previous summary
    const placesToProcess = [...pendingPlaces];
    setGeocodeProgress({ isRunning: true, current: 0, total: placesToProcess.length, found: 0 });
    
    const provider = new OpenStreetMapProvider();
    let foundCount = 0;

    for (let i = 0; i < placesToProcess.length; i++) {
      const place = placesToProcess[i];
      setGeocodeProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const cleanQuery = place.name.replace(/[^\w\s\u0100-\u024F]/gi, '').trim();
        const results = await provider.search({ query: cleanQuery });

        if (results && results.length > 0) {
          const nameWords = cleanQuery.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
          
          const safeMatches = results.filter(match => {
            const raw = match.raw as unknown as Record<string, unknown>;
            const isNotJustCity = raw.class !== 'boundary' && raw.class !== 'place';
            const hasTextMatch = nameWords.some((w: string) => match.label.toLowerCase().includes(w));
            return isNotJustCity && hasTextMatch;
          });

          // STRICT RULE: Only save if exactly one match
          if (safeMatches.length === 1) {
            const bestMatch = safeMatches[0];
            const { error } = await updatePlaceCoords(place.id, bestMatch.y, bestMatch.x);

            if (!error) {
              foundCount++;
              setPendingPlaces(prev => prev.filter(p => p.id !== place.id));
              emit(AppEvent.placesUpdated);
            }
          }
        }
      } catch (err) {
        console.error(`Geocoding error for ${place.name}`, err);
      }

      if (i < placesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setGeocodeProgress({ isRunning: false, current: 0, total: 0, found: 0 });
    setGeocodeSummary(`Zakończono! Znaleziono automatycznie: ${foundCount} z ${placesToProcess.length}.\nReszta (${placesToProcess.length - foundCount}) wymaga ręcznego uzupełnienia.`);
    
    // Auto-hide the summary message after 6 seconds
    setTimeout(() => {
      setGeocodeSummary(null);
    }, 6000);
  };

  // Execute actual deletion from the database
  const executeDeletePending = async (id: string) => {
    const { error } = await deletePlace(id);
    if (!error) {
      setPendingPlaces(prev => prev.filter(p => p.id !== id));
      setDeleteConfirmId(null);
      emit(AppEvent.placesUpdated);
    } else {
      alert("Błąd podczas usuwania.");
    }
  };

  // Unified filter updater for both trips and tags
  const applyFilters = (newTrips: Set<string>, newTags: Set<string>, currentTrips = trips, currentCats = categories) => {
    const params = currentParams();

    const selectedTripNames = Array.from(newTrips).map(id => currentTrips.find(t => t.id === id)?.name).filter(Boolean);
    if (selectedTripNames.length > 0) {
      params.set("trips", selectedTripNames.join(","));
    } else {
      params.set("trips", "none");
    }

    const selectedTagNames = Array.from(newTags).map(id => currentCats.find(c => c.id === id)?.name).filter(Boolean);
    if (selectedTagNames.length > 0) {
      params.set("tags", selectedTagNames.join(","));
    } else {
      params.delete("tags");
    }

    pushParams(router, params);

    // Dispatch event to map
    setTimeout(() => {
      emit(AppEvent.filtersChanged, {
        isEmpty: selectedTripNames.length === 0,
        trips: selectedTripNames.join(","),
        tags: selectedTagNames.join(","),
      });
    }, 50);
  };

  // Fetch trips and categories from database
  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoading(true);

      const tripsData = await fetchTrips();
      const catData = await fetchCategories();

      // Fetch places that are missing coordinates (lat is NULL)
      setPendingPlaces(await loadPendingPlaces());

      if (tripsData) {
        setTrips(tripsData);
        const urlTrips = currentParams().get("trips");
        if (urlTrips === "none") {
          setSelectedIds(new Set());
        } else if (urlTrips) {
          const urlNames = urlTrips.split(",");
          const matchedIds = tripsData.filter(t => urlNames.includes(t.name)).map(t => t.id);
          setSelectedIds(new Set(matchedIds));
        } else {
          setSelectedIds(new Set(tripsData.map(t => t.id)));
        }
      }

      if (catData) {
        setCategories(catData);
        const urlTags = currentParams().get("tags");
        if (urlTags) {
          const urlNames = urlTags.split(",");
          const matchedIds = catData.filter(c => urlNames.includes(c.name)).map(c => c.id);
          setSelectedTags(new Set(matchedIds));
        }
      }

      setIsLoading(false);
    };

    fetchFilters();
    // Async fetch-on-mount: setState runs after await, so cascading-render rule is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPendingPlaces(); // Fetch pending places on initial load

    // Listeners for data updates
    window.addEventListener(AppEvent.tripsUpdated, fetchFilters);

    // Listen for place updates to refresh the pending list
    window.addEventListener(AppEvent.placesUpdated, fetchPendingPlaces);

    // Ensure data is refetched immediately if the session loads with a delay
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        fetchFilters();
        fetchPendingPlaces();
      }
    });

    return () => {
      window.removeEventListener(AppEvent.tripsUpdated, fetchFilters);
      window.removeEventListener(AppEvent.placesUpdated, fetchPendingPlaces);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Toggle handler for trips
  const handleTripToggle = (tripId: string) => {
    const newSet = new Set(selectedIds);
    const descendants = getAllDescendants(tripId, trips);

    if (newSet.has(tripId)) {
      newSet.delete(tripId);
      descendants.forEach(id => newSet.delete(id));
    } else {
      newSet.add(tripId);
      descendants.forEach(id => newSet.add(id));
    }

    setSelectedIds(newSet);
    applyFilters(newSet, selectedTags, trips, categories);
  };

  // Toggle handler for tags
  const handleTagToggle = (tagId: string) => {
    const newSet = new Set(selectedTags);
    if (newSet.has(tagId)) {
      newSet.delete(tagId);
    } else {
      newSet.add(tagId);
    }
    
    setSelectedTags(newSet);
    applyFilters(selectedIds, newSet, trips, categories);
  };

  // Recursive function to render the trip tree
  const renderTree = (parentId: string | null = null, level: number = 0) => {
    const children = trips.filter(t => (t.parent_id || null) === (parentId || null));
    if (children.length === 0) return null;

    return (
      <div className={level === 0 ? "space-y-3 mt-3" : "ml-6 space-y-2 border-l-2 border-gray-100 pl-3 pt-1 mt-2"}>
        {children.map(child => {
          const isChecked = selectedIds.has(child.id);
          return (
            <div key={child.id} className={level === 0 ? "border border-gray-100 rounded-lg p-2.5 shadow-sm bg-white" : ""}>
              <div className={`flex items-center gap-2.5 ${level === 0 ? "mb-1" : ""}`}>
                <input 
                  type="checkbox" 
                  checked={isChecked}
                  onChange={() => handleTripToggle(child.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" 
                />
                <span className={level === 0 ? "text-lg leading-none" : "text-base leading-none"}>
                  {child.icon || (level === 0 ? "🗂️" : "🔖")}
                </span>
                
                <span className={`flex-1 truncate ${level === 0 ? "font-bold text-gray-800" : "text-sm text-gray-700"}`}>
                  {child.name}
                </span>

                <div className="flex items-center gap-1 ml-auto pl-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(router, "share-trip", { tripId: child.id });
                    }}
                    className="flex items-center justify-center w-7 h-7 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors text-base cursor-pointer"
                    title="Udostępnij wycieczkę"
                  >
                    <span className="leading-none pb-0.5 text-lg">📨</span>
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(router, "edit-trip", { tripId: child.id });
                    }}
                    className="flex items-center justify-center w-7 h-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors text-sm cursor-pointer"
                    title="Edytuj"
                  >
                    <span className="leading-none">⚙️</span>
                  </button>
                </div>
              </div>
              {renderTree(child.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Overlay strictly bound to top and bottom of relative parent */}
      {isOpen && (
        <div 
          className="absolute top-0 bottom-0 left-0 right-0 bg-black/20 z-[40]" 
          onClick={onClose} 
        />
      )}

      {/* Sidebar strictly bound to top and bottom */}
      <div 
        className={`absolute top-0 bottom-0 left-0 w-96 bg-gray-50 shadow-2xl z-[50] transform transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-white">
          <h2 className="font-bold text-lg text-gray-800">Filtry i Opcje</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl font-bold cursor-pointer">
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 0. Pending Places Accordion (Only visible if there are pending places) */}
          {pendingPlaces.length > 0 && (
            <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50 shadow-sm">
              <button 
                onClick={() => setIsPendingOpen(!isPendingOpen)} 
                className="w-full flex justify-between items-center p-3.5 hover:bg-amber-100/50 font-semibold text-amber-900 transition-colors cursor-pointer border-b border-amber-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <span>Miejsca do uzupełnienia ({pendingPlaces.length})</span>
                </div>
                <span className="text-xs text-amber-600/70">{isPendingOpen ? '▼' : '▶'}</span>
              </button>
              
              {isPendingOpen && (
                <div className="p-3 space-y-2">
                  
                  {/* Smart Progress Button */}
                  <button 
                    onClick={handleBatchGeocode}
                    disabled={geocodeProgress.isRunning}
                    className={`w-full py-2 text-white text-sm font-bold rounded-lg transition-all shadow-sm flex flex-col items-center justify-center gap-1 mb-3 ${
                      geocodeProgress.isRunning ? "bg-amber-400 cursor-wait" : "bg-amber-500 hover:bg-amber-600 cursor-pointer"
                    }`}
                  >
                    {geocodeProgress.isRunning ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="animate-spin text-lg leading-none">⏳</span>
                          <span>Przeszukiwanie bazy...</span>
                        </div>
                        <span className="text-xs font-medium opacity-90">
                          {geocodeProgress.current} / {geocodeProgress.total} (Znaleziono: {geocodeProgress.found})
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>▶</span> <span>Szukaj automatycznie</span>
                      </div>
                    )}
                  </button>

                  {/* Beautiful inline summary instead of system alert */}
                  {geocodeSummary && (
                    <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs font-medium mb-3 flex justify-between items-start shadow-sm animate-in fade-in zoom-in duration-200">
                      <span className="whitespace-pre-wrap">{geocodeSummary}</span>
                      <button onClick={() => setGeocodeSummary(null)} className="text-green-600 hover:text-green-900 ml-2 cursor-pointer text-sm leading-none">✕</button>
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {pendingPlaces.map(place => (
                      <div key={place.id} className="flex flex-col gap-2">
                        {/* Main list item block */}
                        <div 
                          className={`p-2.5 bg-white border rounded-lg shadow-sm flex justify-between items-center group cursor-pointer transition-colors ${deleteConfirmId === place.id ? 'border-red-300 bg-red-50' : 'border-amber-100 hover:border-amber-300'}`}
                          onClick={() => {
                            if (deleteConfirmId === place.id) return; // Prevent opening edit if confirming deletion
                            openModal(router, "edit-place", { placeId: place.id });
                          }}
                        >
                          <div className="flex flex-col overflow-hidden pr-2">
                            <span className="text-sm font-bold text-gray-800 truncate">{place.name}</span>
                            {place.note && <span className="text-xs text-gray-500 truncate">{place.note}</span>}
                          </div>
                          
                          {/* Action buttons revealed on hover (hide if confirming delete) */}
                          {deleteConfirmId !== place.id && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(place.id); // Open inline confirmation
                                }}
                                className="text-red-600 bg-red-50 hover:bg-red-200 px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                                title="Usuń miejsce"
                              >
                                ✕
                              </button>
                              <span className="text-amber-700 text-xs font-bold whitespace-nowrap bg-amber-100 px-2 py-1 rounded">
                                Edytuj
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Custom inline delete confirmation UI */}
                        {deleteConfirmId === place.id && (
                          <div className="bg-red-50 p-3 rounded-lg flex flex-col items-center animate-in fade-in zoom-in duration-200 border border-red-100 mx-1">
                            <p className="text-xs text-red-800 font-medium mb-3 text-center">Czy na pewno chcesz usunąć to miejsce?</p>
                            <div className="flex gap-2 w-full">
                              <button 
                                onClick={() => setDeleteConfirmId(null)} 
                                className="flex-1 bg-white border border-red-200 text-gray-700 py-1.5 rounded-md text-xs font-medium hover:bg-gray-50 cursor-pointer"
                              >
                                Anuluj
                              </button>
                              <button 
                                onClick={() => executeDeletePending(place.id)} 
                                className="flex-1 bg-red-600 text-white py-1.5 rounded-md text-xs font-bold hover:bg-red-700 cursor-pointer"
                              >
                                Tak, usuń
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1. Folders / Trips Accordion */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button 
              onClick={() => setIsTripsOpen(!isTripsOpen)} 
              className="w-full flex justify-between items-center p-3.5 bg-white hover:bg-gray-50 font-semibold text-gray-700 transition-colors cursor-pointer border-b border-gray-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📁</span>
                <span>Moje zakładki</span>
              </div>
              <span className="text-xs text-gray-400">{isTripsOpen ? '▼' : '▶'}</span>
            </button>
            
            {isTripsOpen && (
              <div className="p-3 bg-gray-50/50">
                {isLoading ? (
                  <p className="text-sm text-gray-500 text-center py-2">Ładowanie...</p>
                ) : trips.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">Brak zakładek.</p>
                ) : (
                  renderTree(null, 0)
                )}
                
                <button 
                  onClick={() => openModal(router, "add-trip")}
                  className="w-full mt-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  + Nowy folder
                </button>
              </div>
            )}
          </div>

          {/* 2. Tags & Categories Accordion */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button 
              onClick={() => setIsTagsOpen(!isTagsOpen)} 
              className="w-full flex justify-between items-center p-3.5 bg-white hover:bg-gray-50 font-semibold text-gray-700 transition-colors cursor-pointer border-b border-gray-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🏷️</span>
                <span>Tagi i Kategorie</span>
              </div>
              <span className="text-xs text-gray-400">{isTagsOpen ? '▼' : '▶'}</span>
            </button>
            
            {isTagsOpen && (
              <div className="p-3 bg-gray-50/50 space-y-3">
                {/* Tag filtering list */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {categories.map(cat => (
                    <label key={cat.id} className="flex items-center gap-2.5 p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors border border-transparent">
                      <input 
                        type="checkbox" 
                        checked={selectedTags.has(cat.id)}
                        onChange={() => handleTagToggle(cat.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" 
                      />
                      <span className="text-base leading-none">{cat.icon}</span>
                      <span className="text-sm font-medium text-gray-700 truncate">{cat.name}</span>
                    </label>
                  ))}
                  {categories.length === 0 && !isLoading && (
                    <p className="text-sm text-gray-500 text-center py-2">Brak tagów.</p>
                  )}
                </div>

                <button 
                  onClick={() => openModal(router, "manage-tags")}
                  className="w-full py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  <span>⚙️</span> Zarządzaj tagami
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}