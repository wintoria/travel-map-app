"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { childrenOf } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { closeModal } from "@/lib/url";
import type { Trip } from "@/lib/types";

export default function EditTripModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modalType = searchParams.get("modal");
  const tripId = searchParams.get("tripId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch current trip and all trips for the hierarchy dropdown
  useEffect(() => {
    if (modalType !== "edit-trip" || !tripId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setShowDeleteConfirm(false);

      const { data: currentTrip } = await supabase.from("trips").select("*").eq("id", tripId).single();
      if (currentTrip) setTrip(currentTrip as Trip);

      const { data: tripsData } = await supabase.from("trips").select("id, name, parent_id, icon").order("created_at", { ascending: true });
      if (tripsData) setAllTrips(tripsData as Trip[]);

      setIsLoading(false);
    };

    fetchData();
  }, [modalType, tripId]);

  const handleClose = () => closeModal(router, ["tripId"]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name") as string;
      const icon = formData.get("icon") as string;
      const parentId = formData.get("parentId") as string;

      const { error } = await supabase.from("trips").update({
        name,
        icon: icon || null,
        parent_id: parentId || null,
      }).eq("id", tripId);

      if (error) throw error;

      // Refresh Sidebar and map, then close
      emit(AppEvent.tripsUpdated);
      emit(AppEvent.filtersChanged);
      handleClose();
    } catch (error) {
      console.error("Update error:", error);
      alert("Wystąpił błąd podczas zapisywania zakładki.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    
    // Note: If this folder has children, Supabase must have CASCADE DELETE enabled,
    // otherwise this might throw a foreign key error.
    const { error } = await supabase.from("trips").delete().eq("id", tripId);
    
    if (error) {
      console.error("Delete error:", error);
      alert("Nie można usunąć zakładki. Upewnij się, że nie zawiera innych podzakładek.");
      setIsSubmitting(false);
    } else {
      emit(AppEvent.tripsUpdated);
      emit(AppEvent.filtersChanged);
      handleClose();
    }
  };

  if (modalType !== "edit-trip") return null;

  // Recursive dropdown options, disabling the current trip to prevent circular hierarchy
  const renderOptions = (parentId: string | null = null, level: number = 0) => {
    const children = childrenOf(allTrips, parentId);

    return children.map((child) => {
      const isSelf = child.id === tripId;
      
      return (
        <React.Fragment key={child.id}>
          <option value={child.id} disabled={isSelf} className={level === 0 ? "font-bold" : ""}>
            {"\u00A0\u00A0\u00A0".repeat(level)}
            {level > 0 ? "└ " : ""}
            {child.name}
          </option>
          {renderOptions(child.id, level + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Edytuj zakładkę</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-800 text-xl font-bold cursor-pointer">
            ✕
          </button>
        </div>

        {isLoading ? (
          <p className="text-center p-6 text-gray-500">Ładowanie...</p>
        ) : (
          <div className="p-5 flex flex-col space-y-4">
            
            <form id="edit-trip-form" onSubmit={handleSubmit} className="flex flex-col space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa *</label>
                <input type="text" name="name" required defaultValue={trip?.name} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ikona (emoji)</label>
                <input type="text" name="icon" defaultValue={trip?.icon ?? ""} maxLength={2} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Folder nadrzędny</label>
                <select name="parentId" defaultValue={trip?.parent_id || ""} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white">
                  <option value="">-- Brak (Katalog główny) --</option>
                  {renderOptions(null, 0)}
                </select>
              </div>
            </form>

            <div className="border-t border-gray-100 pt-4 mt-2">
              {showDeleteConfirm ? (
                <div className="bg-red-50 p-3 rounded-lg flex flex-col items-center">
                  <p className="text-sm text-red-800 font-medium mb-3 text-center">Usunąć zakładkę i wszystkie miejsca w niej?</p>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-white border border-red-200 text-gray-700 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 cursor-pointer">
                      Anuluj
                    </button>
                    <button onClick={handleDelete} disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-1.5 rounded-md text-sm font-bold hover:bg-red-700 disabled:bg-red-400 cursor-pointer">
                      Tak, usuń
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(true)} type="button" className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2.5 rounded-lg transition-colors text-sm cursor-pointer">
                    Usuń
                  </button>
                  <button type="submit" form="edit-trip-form" disabled={isSubmitting} className="flex-[2] bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 cursor-pointer">
                    Zapisz
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}