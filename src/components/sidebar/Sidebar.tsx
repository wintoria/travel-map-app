"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { fetchTrips } from "@/lib/api/trips";
import { fetchCategories, sortCategories } from "@/lib/api/categories";
import { fetchPendingPlaces as loadPendingPlaces, deletePlace } from "@/lib/api/places";
import { batchGeocodePlaces } from "@/lib/geocode";
import { getAllDescendants } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { currentParams, openModal, pushParams } from "@/lib/url";
import toast from "react-hot-toast";
import {
  Folder,
  Bookmark,
  Share2,
  Settings,
  X,
  MapPin,
  Loader2,
  ChevronRight,
  ChevronDown,
  Tag,
} from "lucide-react";
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

    const { found: foundCount } = await batchGeocodePlaces(placesToProcess, {
      onProgress: (current) => setGeocodeProgress(prev => ({ ...prev, current })),
      onResult: (place, wasFound) => {
        if (wasFound) {
          setPendingPlaces(prev => prev.filter(p => p.id !== place.id));
        }
      },
    });

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
      toast.error("Błąd podczas usuwania.");
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
        const sortedCats = sortCategories(catData);
        setCategories(sortedCats);
        const urlTags = currentParams().get("tags");
        if (urlTags) {
          const urlNames = urlTags.split(",");
          const matchedIds = sortedCats.filter(c => urlNames.includes(c.name)).map(c => c.id);
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
    window.addEventListener(AppEvent.categoriesUpdated, fetchFilters);

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
      window.removeEventListener(AppEvent.categoriesUpdated, fetchFilters);
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
      <div className={level === 0 ? "space-y-3 mt-3" : "ml-6 space-y-2 border-l-2 border-base-300 pl-3 pt-1 mt-2"}>
        {children.map(child => {
          const isChecked = selectedIds.has(child.id);
          return (
            <div key={child.id} className={level === 0 ? "border border-base-300 rounded-lg p-2.5 shadow-sm bg-base-200" : ""}>
              <div className={`flex items-center gap-2.5 ${level === 0 ? "mb-1" : ""}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleTripToggle(child.id)}
                  className="checkbox checkbox-primary checkbox-sm cursor-pointer"
                />
                <span className={level === 0 ? "text-lg leading-none" : "text-base leading-none"}>
                  {child.icon || (level === 0 ? <Folder size={16} /> : <Bookmark size={16} />)}
                </span>

                <span className={`flex-1 truncate ${level === 0 ? "font-bold text-base-content" : "text-sm text-base-content/80"}`}>
                  {child.name}
                </span>

                <div className="flex items-center gap-1 ml-auto pl-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(router, "share-trip", { tripId: child.id });
                    }}
                    className="flex items-center justify-center w-7 h-7 text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors text-base cursor-pointer"
                    title="Udostępnij wycieczkę"
                  >
                    <Share2 size={16} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(router, "edit-trip", { tripId: child.id });
                    }}
                    className="flex items-center justify-center w-7 h-7 text-muted hover:text-base-content hover:bg-base-300 rounded transition-colors text-sm cursor-pointer"
                    title="Edytuj"
                  >
                    <Settings size={16} />
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
          className="absolute top-0 bottom-0 left-0 right-0 bg-black/50 z-[40]"
          onClick={onClose}
        />
      )}

      {/* Sidebar strictly bound to top and bottom */}
      <div
        className={`absolute top-0 bottom-0 left-0 w-96 bg-base-200 shadow-2xl z-[50] transform transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-base-300 flex justify-between items-center bg-base-200">
          <h2 className="font-bold text-lg text-base-content">Filtry i Opcje</h2>
          <button onClick={onClose} className="text-base-content/70 hover:text-base-content font-bold cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 0. Pending Places Accordion (Only visible if there are pending places) */}
          {pendingPlaces.length > 0 && (
            <div className="border border-warning/40 rounded-xl overflow-hidden bg-warning/10 shadow-sm">
              <button
                onClick={() => setIsPendingOpen(!isPendingOpen)}
                className="w-full flex justify-between items-center p-3.5 hover:bg-warning/20 font-semibold text-warning transition-colors cursor-pointer border-b border-warning/20"
              >
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>Miejsca do uzupełnienia ({pendingPlaces.length})</span>
                </div>
                <span className="text-xs text-warning/70">{isPendingOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              </button>
              
              {isPendingOpen && (
                <div className="p-3 space-y-2">
                  
                  {/* Smart Progress Button */}
                  <button
                    onClick={handleBatchGeocode}
                    disabled={geocodeProgress.isRunning}
                    className={`w-full py-2 text-warning-content text-sm font-bold rounded-lg transition-all shadow-sm flex flex-col items-center justify-center gap-1 mb-3 ${
                      geocodeProgress.isRunning ? "bg-warning/40 cursor-wait" : "bg-warning hover:bg-warning/90 cursor-pointer"
                    }`}
                  >
                    {geocodeProgress.isRunning ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Przeszukiwanie bazy...</span>
                        </div>
                        <span className="text-xs font-medium opacity-90">
                          {geocodeProgress.current} / {geocodeProgress.total} (Znaleziono: {geocodeProgress.found})
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <ChevronRight size={16} /> <span>Szukaj automatycznie</span>
                      </div>
                    )}
                  </button>

                  {/* Beautiful inline summary instead of system alert */}
                  {geocodeSummary && (
                    <div className="bg-success/15 border border-success/40 text-success p-3 rounded-lg text-xs font-medium mb-3 flex justify-between items-start shadow-sm animate-in fade-in zoom-in duration-200">
                      <span className="whitespace-pre-wrap">{geocodeSummary}</span>
                      <button onClick={() => setGeocodeSummary(null)} className="text-success hover:text-success/80 ml-2 cursor-pointer text-sm leading-none">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {pendingPlaces.map(place => (
                      <div key={place.id} className="flex flex-col gap-2">
                        {/* Main list item block */}
                        <div
                          className={`p-2.5 bg-base-200 border rounded-lg shadow-sm flex justify-between items-center group cursor-pointer transition-colors ${deleteConfirmId === place.id ? 'border-error/40 bg-error/15' : 'border-warning/20 hover:border-warning/50'}`}
                          onClick={() => {
                            if (deleteConfirmId === place.id) return; // Prevent opening edit if confirming deletion
                            openModal(router, "edit-place", { placeId: place.id });
                          }}
                        >
                          <div className="flex flex-col overflow-hidden pr-2">
                            <span className="text-sm font-bold text-base-content truncate">{place.name}</span>
                            {place.note && <span className="text-xs text-base-content/70 truncate">{place.note}</span>}
                          </div>

                          {/* Action buttons revealed on hover (hide if confirming delete) */}
                          {deleteConfirmId !== place.id && (
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(place.id); // Open inline confirmation
                                }}
                                className="text-error bg-error/10 hover:bg-error/20 px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                                title="Usuń miejsce"
                              >
                                <X size={14} />
                              </button>
                              <span className="text-warning text-xs font-bold whitespace-nowrap bg-warning/20 px-2 py-1 rounded">
                                Edytuj
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Custom inline delete confirmation UI */}
                        {deleteConfirmId === place.id && (
                          <div className="bg-error/15 p-3 rounded-lg flex flex-col items-center animate-in fade-in zoom-in duration-200 border border-error/40 mx-1">
                            <p className="text-xs text-error font-medium mb-3 text-center">Czy na pewno chcesz usunąć to miejsce?</p>
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 bg-base-200 border border-error/30 text-base-content/70 py-1.5 rounded-md text-xs font-medium hover:bg-base-300 cursor-pointer"
                              >
                                Anuluj
                              </button>
                              <button
                                onClick={() => executeDeletePending(place.id)}
                                className="flex-1 bg-error hover:bg-error/90 text-error-content py-1.5 rounded-md text-xs font-bold cursor-pointer"
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
          <div className="border border-base-300 rounded-xl overflow-hidden bg-base-200 shadow-sm">
            <button
              onClick={() => setIsTripsOpen(!isTripsOpen)}
              className="w-full flex justify-between items-center p-3.5 bg-base-200 hover:bg-base-300 font-semibold text-base-content/80 transition-colors cursor-pointer border-b border-base-300"
            >
              <div className="flex items-center gap-2">
                <Folder size={16} />
                <span>Moje zakładki</span>
              </div>
              <span className="text-xs text-muted">{isTripsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
            </button>

            {isTripsOpen && (
              <div className="p-3 bg-base-100/50">
                {isLoading ? (
                  <p className="text-sm text-base-content/70 text-center py-2">Ładowanie...</p>
                ) : trips.length === 0 ? (
                  <p className="text-sm text-base-content/70 text-center py-2">Brak zakładek.</p>
                ) : (
                  renderTree(null, 0)
                )}

                <button
                  onClick={() => openModal(router, "add-trip")}
                  className="w-full mt-3 py-2 bg-base-200 border border-base-300 hover:bg-base-300 text-base-content/80 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  + Nowy folder
                </button>
              </div>
            )}
          </div>

          {/* 2. Tags & Categories Accordion */}
          <div className="border border-base-300 rounded-xl overflow-hidden bg-base-200 shadow-sm">
            <button
              onClick={() => setIsTagsOpen(!isTagsOpen)}
              className="w-full flex justify-between items-center p-3.5 bg-base-200 hover:bg-base-300 font-semibold text-base-content/80 transition-colors cursor-pointer border-b border-base-300"
            >
              <div className="flex items-center gap-2">
                <Tag size={16} />
                <span>Tagi i Kategorie</span>
              </div>
              <span className="text-xs text-muted">{isTagsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
            </button>

            {isTagsOpen && (
              <div className="p-3 bg-base-100/50 space-y-3">
                {/* Tag filtering list */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {categories.map(cat => (
                    <label key={cat.id} className="flex items-center gap-2.5 p-2 rounded hover:bg-base-300 cursor-pointer transition-colors border border-transparent">
                      <input
                        type="checkbox"
                        checked={selectedTags.has(cat.id)}
                        onChange={() => handleTagToggle(cat.id)}
                        className="checkbox checkbox-primary checkbox-sm cursor-pointer"
                      />
                      <span className="text-base leading-none">{cat.icon}</span>
                      <span className="text-sm font-medium text-base-content/80 truncate">{cat.name}</span>
                    </label>
                  ))}
                  {categories.length === 0 && !isLoading && (
                    <p className="text-sm text-base-content/70 text-center py-2">Brak tagów.</p>
                  )}
                </div>

                <button
                  onClick={() => openModal(router, "manage-tags")}
                  className="w-full py-2 bg-base-200 border border-base-300 hover:bg-base-300 text-base-content/80 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  <Settings size={16} /> Zarządzaj tagami
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}