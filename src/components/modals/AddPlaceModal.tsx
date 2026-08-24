"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import TagSelector from "@/components/tags/TagSelector";
import { childrenOf } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { fetchTripsBasic } from "@/lib/api/trips";
import { createPlace } from "@/lib/api/places";
import { PENDING_SYNC_MESSAGE } from "@/lib/offline/network";
import { notifyPendingSync } from "@/lib/toast";
import toast from "react-hot-toast";
import type { Trip } from "@/lib/types";

type TripOption = Pick<Trip, "id" | "name" | "icon" | "parent_id">;

export default function AddPlaceModal({ currentView }: { currentView: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [trips, setTrips] = useState<TripOption[]>([]);

  // Fetch available trips for the dropdown
  useEffect(() => {
    fetchTripsBasic().then(setTrips);
  }, []);

  // Recursive function to build infinite dropdown nesting
  const renderOptions = (parentId: string | null = null, level: number = 0) => {
    const children = childrenOf(trips, parentId);
    return children.map((child) => (
      <React.Fragment key={child.id}>
        <option value={child.id} className={level === 0 ? "font-bold" : ""}>
          {"   ".repeat(level)}
          {level > 0 ? "└ " : ""}
          {child.icon ? `${child.icon} ` : ""}{child.name}
        </option>
        {renderOptions(child.id, level + 1)}
      </React.Fragment>
    ));
  };

  // Extract data passed from the map search or click
  const defaultName = searchParams.get("name") || "";
  const defaultAddress = searchParams.get("address") || "";
  const defaultLat = searchParams.get("lat") || "";
  const defaultLng = searchParams.get("lng") || "";

  const isFromMap = !!defaultLat && !!defaultLng;
  const isNameLocked = searchParams.get("lockedName") === "true"; // Check if name should be locked

  const handleClose = () => router.push(`?view=${currentView}`, { scroll: false });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent default page reload
    setIsSubmitting(true);

    try {
      // 1. Gather all data from the form
      const formData = new FormData(e.currentTarget);

      const name = formData.get("name") as string;
      const lat = parseFloat(formData.get("lat") as string);
      const lng = parseFloat(formData.get("lng") as string);
      const address = formData.get("address") as string;
      const duration = formData.get("duration") as string;
      const note = formData.get("note") as string;
      const visited = formData.get("visited") === "on";
      let googleMapsUrl = formData.get("googleMapsUrl") as string;

      // Auto-generate Google Maps URL if it was left empty
      if (!googleMapsUrl && !isNaN(lat) && !isNaN(lng)) {
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      }

      // Get the additional custom link
      const additionalInfo = formData.get("additionalInfoUrl") as string;

      // File input (empty selection still yields a zero-size File, handled by createPlace)
      const file = formData.get("additionalInfoFile") as File;

      // Read trip_id from the new dropdown
      const trip_id = formData.get("trip_id") as string;

      // Read selected category IDs from the hidden input
      const categoryIds: string[] = JSON.parse((formData.get("category_ids") as string) || "[]");

      // Create the place (handles the attachment upload, DB insert and category relations,
      // and transparently queues everything for later sync if we're offline)
      const created = await createPlace(
        {
          trip_id,
          name,
          lat,
          lng,
          address,
          duration,
          note,
          google_maps_url: googleMapsUrl,
          visited,
          additional_link: additionalInfo,
        },
        file && file.size > 0 ? file : null,
        categoryIds
      );

      // Close the modal immediately so it feels fast
      handleClose();

      // Delay the refresh signal slightly so database and cache can sync
      setTimeout(() => {
        emit(AppEvent.placesUpdated);
      }, 300);

      if (created._pendingSync) notifyPendingSync(PENDING_SYNC_MESSAGE);

    } catch (error) {
      console.error("Save error:", error);
      toast.error("Nie udało się zapisać miejsca.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={handleClose} title="Dodaj nowe miejsce" maxWidth="max-w-xl" zIndex="z-[60]">
      {/* Form with browser autocomplete disabled */}
      <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4 flex flex-col p-6 pt-4">

        {/* Place Name Input */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Nazwa miejsca *</label>
          <input
            type="text"
            name="name"
            required
            defaultValue={defaultName}
            readOnly={isNameLocked}
            autoComplete="off"
            className={`input input-bordered w-full border-base-300 ${isNameLocked ? 'bg-base-300/50 text-base-content/50' : 'bg-base-100 text-base-content focus:border-primary'}`}
            placeholder="np. Bakkerij Wolf"
          />
        </div>

        {/* Trip / Folder Selection */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Zakładka *</label>
          <select
            name="trip_id"
            required
            className="select select-bordered w-full bg-base-100 border-base-300 text-base-content"
          >
            <option value="">-- Wybierz zakładkę --</option>
            {renderOptions(null, 0)}
          </select>
        </div>

        {/* Coordinates (Lat & Lng) Inputs */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-base-content/80 mb-1">Szerokość (Lat) *</label>
            <input
              type="text"
              name="lat"
              required
              defaultValue={defaultLat}
              readOnly={isFromMap}
              autoComplete="off"
              className={`input input-bordered w-full border-base-300 ${isFromMap ? 'bg-base-300/50 text-base-content/50' : 'bg-base-100 text-base-content focus:border-primary'}`}
              placeholder="np. 53.428"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-base-content/80 mb-1">Długość (Lng) *</label>
            <input
              type="text"
              name="lng"
              required
              defaultValue={defaultLng}
              readOnly={isFromMap}
              autoComplete="off"
              className={`input input-bordered w-full border-base-300 ${isFromMap ? 'bg-base-300/50 text-base-content/50' : 'bg-base-100 text-base-content focus:border-primary'}`}
              placeholder="np. 14.552"
            />
          </div>
        </div>

        {/* Address Input */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Adres</label>
          <input
            type="text"
            name="address"
            defaultValue={defaultAddress}
            readOnly={isFromMap}
            autoComplete="off"
            className={`input input-bordered w-full border-base-300 ${isFromMap ? 'bg-base-300/50 text-base-content/50' : 'bg-base-100 text-base-content focus:border-primary'}`}
            placeholder="Wpisz adres"
          />
        </div>

        {/* Estimated Duration Input */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Szacowany czas</label>
          <input
            type="text"
            name="duration"
            autoComplete="off"
            className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary"
            placeholder="np. 2-3h, 30 min"
          />
        </div>

        {/* Note Textarea */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Notatka</label>
          <textarea
            name="note"
            rows={3}
            autoComplete="off"
            className="textarea textarea-bordered w-full bg-base-100 border-base-300 text-base-content resize-none"
            placeholder="Co warto wiedzieć o tym miejscu?"
          />
        </div>

        {/* Tag / Category Selector */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Tagi / Kategorie</label>
          <TagSelector />
        </div>

        {/* Google Maps URL Input */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Google Maps</label>
          <input
            type="url"
            name="googleMapsUrl"
            autoComplete="off"
            className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary"
            placeholder="np. gotowy link z aplikacji"
          />
        </div>

        {/* Additional Info (URL & File Upload) */}
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">
            Dodatkowe informacje (Strona WWW i/lub Załącznik)
          </label>
          <div className="flex flex-col gap-3">
            <input
              type="url"
              name="additionalInfoUrl"
              autoComplete="off"
              className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary"
              placeholder="Wklej link (np. rezerwacja, oficjalna strona)"
            />
            <input
              type="file"
              name="additionalInfoFile"
              accept=".pdf,image/*"
              className="block w-full text-sm text-base-content/60 file:mr-4 file:py-2 file:px-4 file:font-semibold file:bg-primary/15 file:text-primary file:border-0 file:rounded-full hover:file:bg-primary/25 cursor-pointer"
            />
          </div>
        </div>

        {/* Visited Status Checkbox */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="visited"
            id="visited"
            className="checkbox checkbox-primary"
          />
          <label htmlFor="visited" className="text-sm font-medium text-base-content/80 cursor-pointer">
            Oznacz jako odwiedzone
          </label>
        </div>

        {/* Submit Button */}
        <Button type="submit" variant="primary" fullWidth disabled={isSubmitting} className="mt-4">
          {isSubmitting ? "Zapisywanie..." : "Zapisz miejsce"}
        </Button>

      </form>
    </Modal>
  );
}