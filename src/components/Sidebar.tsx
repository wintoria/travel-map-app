"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Data states
  const [trips, setTrips] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Accordion states for UI sections
  const [isTripsOpen, setIsTripsOpen] = useState(true);
  const [isTagsOpen, setIsTagsOpen] = useState(false);

  // Unified filter updater for both trips and tags
  const applyFilters = (newTrips: Set<string>, newTags: Set<string>, currentTrips = trips, currentCats = categories) => {
    const params = new URLSearchParams(window.location.search);

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

    router.push(`?${params.toString()}`, { scroll: false });

    // Dispatch event to map
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("filters-changed", {
          detail: { 
            isEmpty: selectedTripNames.length === 0, 
            trips: selectedTripNames.join(","), 
            tags: selectedTagNames.join(",") 
          }
        })
      );
    }, 50);
  };

  // Fetch trips and categories from database
  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoading(true);

      const { data: tripsData } = await supabase.from("trips").select("*").order("created_at", { ascending: true });
      const { data: catData } = await supabase.from("categories").select("*").order("name");

      if (tripsData) {
        setTrips(tripsData);
        const urlTrips = new URLSearchParams(window.location.search).get("trips");
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
        const urlTags = new URLSearchParams(window.location.search).get("tags");
        if (urlTags) {
          const urlNames = urlTags.split(",");
          const matchedIds = catData.filter(c => urlNames.includes(c.name)).map(c => c.id);
          setSelectedTags(new Set(matchedIds));
        }
      }

      setIsLoading(false);
    };

    fetchFilters();

    // Listeners for data updates
    window.addEventListener("trips-updated", fetchFilters);
    return () => {
      window.removeEventListener("trips-updated", fetchFilters);
    };
  }, []);

  // Recursive function to get all descendants of a specific trip
  const getAllDescendants = (parentId: string, allTrips: any[]): string[] => {
    const children = allTrips.filter(t => t.parent_id === parentId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getAllDescendants(c.id, allTrips)];
    });
    return ids;
  };

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

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const params = new URLSearchParams(window.location.search);
                    params.set("modal", "edit-trip");
                    params.set("tripId", child.id);
                    router.push(`?${params.toString()}`, { scroll: false });
                  }}
                  className="text-gray-400 hover:text-gray-700 transition-colors text-sm px-1 cursor-pointer"
                  title="Edytuj"
                >
                  ⚙️
                </button>
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
        className={`absolute top-0 bottom-0 left-0 w-80 bg-gray-50 shadow-2xl z-[50] transform transition-transform duration-300 flex flex-col ${
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
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("modal", "add-trip");
                    router.push(`?${params.toString()}`, { scroll: false });
                  }}
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
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("modal", "manage-tags");
                    router.push(`?${params.toString()}`, { scroll: false });
                  }}
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