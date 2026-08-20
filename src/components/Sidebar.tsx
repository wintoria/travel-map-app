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
  }, []);

  // Separate root folders from child folders
  const rootTrips = trips.filter((t) => !t.parent_id);
  const getChildren = (parentId: string) => trips.filter((t) => t.parent_id === parentId);

  // Handle clicking a parent folder (selects/deselects all children)
  const handleParentToggle = (parentId: string, childIds: string[]) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(parentId)) {
      // Uncheck parent and all children
      newSet.delete(parentId);
      childIds.forEach(id => newSet.delete(id));
    } else {
      // Check parent and all children
      newSet.add(parentId);
      childIds.forEach(id => newSet.add(id));
    }
    setSelectedIds(newSet);
    updateUrlFilters(newSet, trips);
  };

  // Handle clicking a child folder (Cascading logic)
  const handleChildToggle = (childId: string, parentId: string, childIds: string[]) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(childId)) {
      // Uncheck child and parent
      newSet.delete(childId);
      newSet.delete(parentId);
    } else {
      // Check child
      newSet.add(childId);
      // Check if all children are now checked - if so, check the parent
      const allChecked = childIds.every(id => newSet.has(id));
      if (allChecked) {
        newSet.add(parentId);
      }
    }
    setSelectedIds(newSet);
    updateUrlFilters(newSet, trips);
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
          ) : rootTrips.length === 0 ? (
            <p className="text-sm text-gray-500 text-center mt-4">Brak wyjazdów.</p>
          ) : (
            <div className="space-y-4">
              {rootTrips.map((root) => {
                const children = getChildren(root.id);
                const childIds = children.map(c => c.id);
                const isParentChecked = selectedIds.has(root.id);

                return (
                  <div key={root.id} className="border border-gray-100 rounded-xl p-3 shadow-sm bg-white">
                    
                    {/* Parent Folder */}
                    <div className="flex items-center gap-3 mb-2">
                      <input 
                        type="checkbox" 
                        checked={isParentChecked}
                        onChange={() => handleParentToggle(root.id, childIds)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" 
                      />
                      <span className="text-lg leading-none">{root.icon || "📁"}</span>
                      <span className="font-bold text-gray-800">{root.name}</span>
                    </div>
                    
                    {/* Child Folders */}
                    {children.length > 0 && (
                      <div className="ml-7 space-y-2 border-l-2 border-gray-100 pl-3 pt-1">
                        {children.map((child) => (
                          <div key={child.id} className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.has(child.id)}
                              onChange={() => handleChildToggle(child.id, root.id, childIds)}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" 
                            />
                            <span className="text-base leading-none">{child.icon || "📍"}</span>
                            <span className="text-sm text-gray-700">{child.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm">
            + Nowy folder
          </button>
        </div>
      </div>
    </>
  );
}