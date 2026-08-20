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
  
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Helper to update URL using pretty names instead of UUIDs
  const updateUrlFilters = (newSet: Set<string>, allTrips: any[]) => {
    const params = new URLSearchParams(window.location.search);
    const selectedNames = Array.from(newSet)
      .map(id => allTrips.find(t => t.id === id)?.name)
      .filter(Boolean);

    if (selectedNames.length > 0) {
      params.set("trips", selectedNames.join(","));
    } else {
      // Explicit flag for completely empty map
      params.set("trips", "none");
    }
    router.push(`?${params.toString()}`, { scroll: false });
    
   // Dispatch custom event with explicit data so the map knows exact intent without waiting for Next.js router
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("filters-changed", {
          detail: { isEmpty: selectedNames.length === 0, trips: selectedNames.join(",") }
        })
      );
    }, 50);
  };

  // Fetch trips from database
  useEffect(() => {
    const fetchTrips = async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("created_at", { ascending: true });
        
      if (!error && data) {
        setTrips(data);
        
        // Match initial checked state from URL or check everything by default
        const urlTrips = new URLSearchParams(window.location.search).get("trips");
        
        if (urlTrips === "none") {
          setSelectedIds(new Set()); // Start empty
        } else if (urlTrips) {
          const urlNames = urlTrips.split(",");
          const matchedIds = data.filter(t => urlNames.includes(t.name)).map(t => t.id);
          setSelectedIds(new Set(matchedIds));
        } else {
          // No params at all = user just opened the app. Check everything!
          setSelectedIds(new Set(data.map(t => t.id)));
        }
      }
      setIsLoading(false);
    };

    fetchTrips();

    // Listen for custom event to refresh trips list when a new one is added
    window.addEventListener("trips-updated", fetchTrips);
    return () => window.removeEventListener("trips-updated", fetchTrips);
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

  // Generic toggle handler for infinite levels
  const handleToggle = (tripId: string) => {
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
    updateUrlFilters(newSet, trips);
  };

  // Recursive function to render the UI tree
  const renderTree = (parentId: string | null = null, level: number = 0) => {
    const children = trips.filter(t => (t.parent_id || null) === (parentId || null));
    if (children.length === 0) return null;

    return (
      <div className={level === 0 ? "space-y-4" : "ml-7 space-y-2 border-l-2 border-gray-100 pl-3 pt-1 mt-2"}>
        {children.map(child => {
          const isChecked = selectedIds.has(child.id);
          return (
            <div key={child.id} className={level === 0 ? "border border-gray-100 rounded-xl p-3 shadow-sm bg-white" : ""}>
              <div className={`flex items-center gap-3 ${level === 0 ? "mb-2" : ""}`}>
                <input 
                  type="checkbox" 
                  checked={isChecked}
                  onChange={() => handleToggle(child.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" 
                />
                <span className={level === 0 ? "text-lg leading-none" : "text-base leading-none"}>
                  {child.icon || (level === 0 ? "🗂️" : "🔖")}
                </span>
                
                {/* Push the gear icon to the right */}
                <span className={`flex-1 truncate ${level === 0 ? "font-bold text-gray-800" : "text-sm text-gray-700"}`}>
                  {child.name}
                </span>

                {/* Edit bookmark button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const params = new URLSearchParams(window.location.search);
                    params.set("modal", "edit-trip");
                    params.set("tripId", child.id);
                    router.push(`?${params.toString()}`, { scroll: false });
                  }}
                  className="text-gray-400 hover:text-gray-700 transition-colors text-sm px-1 cursor-pointer"
                >
                  ⚙️
                </button>
              </div>
              {/* Render grandchildren recursively */}
              {renderTree(child.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Overlay constrained to the main container */}
      {isOpen && (
        <div 
          className="absolute inset-0 bg-black/20 z-[40]"
          onClick={onClose}
        />
      )}

      {/* Sidebar constrained to the main container */}
      <div 
        className={`absolute top-0 left-0 h-full w-80 bg-white shadow-2xl z-[50] transform transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-lg text-gray-800">Moje zakładki</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl font-bold cursor-pointer">
            ✕
          </button>
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-sm text-gray-500 text-center mt-4">Ładowanie...</p>
          ) : trips.length === 0 ? (
            <p className="text-sm text-gray-500 text-center mt-4">Brak zakładek.</p>
          ) : (
            renderTree(null, 0)
          )}
        </div>
        
        {/* Action buttons */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set("modal", "add-trip");
              router.push(`?${params.toString()}`, { scroll: false });
            }}
            className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            + Nowy folder
          </button>
        </div>
      </div>
    </>
  );
}