"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { childrenOf } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { closeModal } from "@/lib/url";
import { fetchTripsBasic, createTrip } from "@/lib/api/trips";
import type { Trip } from "@/lib/types";

type TripOption = Pick<Trip, "id" | "name" | "icon" | "parent_id">;

export default function AddTripModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modalType = searchParams.get("modal");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trips, setTrips] = useState<TripOption[]>([]);

  // Fetch all folders to build hierarchy in the dropdown
  useEffect(() => {
    if (modalType !== "add-trip") return;
    fetchTripsBasic().then(setTrips);
  }, [modalType]);

  const handleClose = () => closeModal(router);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const name = formData.get("name") as string;
      const icon = formData.get("icon") as string;
      const parentId = formData.get("parentId") as string;

      await createTrip({
        name,
        icon: icon || null,
        parent_id: parentId || null,
      });

      // Close modal and dispatch event to refresh the Sidebar
      emit(AppEvent.tripsUpdated);
      handleClose();

    } catch (error) {
      console.error("Insert error:", error);
      alert("Wystąpił błąd podczas dodawania zakładki.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (modalType !== "add-trip") return null;

  // Foolproof recursive function to build infinite dropdown nesting
  const renderOptions = (parentId: string | null = null, level: number = 0) => {
    // Treat undefined and null as the same root level
    const children = childrenOf(trips, parentId);

    return children.map((child) => (
      <React.Fragment key={child.id}>
        <option value={child.id} className={level === 0 ? "font-bold" : ""}>
          {"\u00A0\u00A0\u00A0".repeat(level)}
          {level > 0 ? "└ " : ""}
          {child.name}
        </option>
        {/* Recursively call for children of this child */}
        {renderOptions(child.id, level + 1)}
      </React.Fragment>
    ));
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Nowa zakładka</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-800 text-xl font-bold cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa *</label>
            <input type="text" name="name" required placeholder="np. Wakacje 2026" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ikona (emoji)</label>
            <input type="text" name="icon" placeholder="np. 🗺️" maxLength={2} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Folder nadrzędny (opcjonalnie)</label>
            <select name="parentId" className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white">
              <option value="">-- Brak (Katalog główny) --</option>
              {renderOptions(null, 0)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Możesz zagnieżdżać zakładki nieskończenie (np. Wakacje -&gt; Holandia -&gt; Amsterdam).</p>
          </div>

          <div className="pt-2 flex gap-3">
            <button 
              type="button" 
              onClick={handleClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex-[2] bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 cursor-pointer"
            >
              {isSubmitting ? "Zapisywanie..." : "Dodaj zakładkę"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}