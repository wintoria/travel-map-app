"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, MapPin, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import TagSelector from "@/components/tags/TagSelector";
import { OpenStreetMapProvider } from "leaflet-geosearch";
import { childrenOf } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { closeModal, openModal } from "@/lib/url";
import { fetchTripsBasic } from "@/lib/api/trips";
import { fetchPlaceWithCategories, updatePlace, type EditPlace } from "@/lib/api/places";
import { PENDING_SYNC_MESSAGE } from "@/lib/offline/network";
import { notifyPendingSync } from "@/lib/toast";
import toast from "react-hot-toast";
import type { Trip } from "@/lib/types";

// A geocoding result from leaflet-geosearch (coordinates in y/x).
type GeoResult = { x: number; y: number; label: string };
type TripOption = Pick<Trip, "id" | "name" | "icon" | "parent_id">;

export default function EditPlaceModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modalType = searchParams.get("modal");
  const placeId = searchParams.get("placeId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingCoords, setIsSearchingCoords] = useState(false);
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [place, setPlace] = useState<EditPlace | null>(null);
  const [initialCategories, setInitialCategories] = useState<string[]>([]);

  // Refs to directly manipulate the form inputs without re-rendering everything
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  // Store all available trips for the dropdown hierarchy
  const [trips, setTrips] = useState<TripOption[]>([]);

  // Fetch existing data to populate the form
  useEffect(() => {
    if (modalType !== "edit-place" || !placeId) return;

    const fetchData = async () => {
      // Force the loading screen to show every time the modal opens
      setIsLoading(true);

      const placeData = await fetchPlaceWithCategories(placeId);
      if (placeData) {
        setPlace(placeData);
        if (placeData.place_categories) {
          setInitialCategories(placeData.place_categories.map((pc) => pc.category_id));
        }
      }

      const tripsData = await fetchTripsBasic();
      setTrips(tripsData);

      // Hide loading screen only after new data is ready
      setIsLoading(false);
    };
    fetchData();

  }, [modalType, placeId]);

  // Close completely to map view by clearing modal parameters
  const handleCloseToMap = () => closeModal(router, ["placeId"]);

  // Go back to the view details modal (keep the same placeId, just change modal type)
  const handleBackToDetails = () => openModal(router, "view-place");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      const name = formData.get("name") as string;
      const trip_id = formData.get("trip_id") as string;
      const lat = parseFloat(formData.get("lat") as string);
      const lng = parseFloat(formData.get("lng") as string);
      const address = formData.get("address") as string;
      const duration = formData.get("duration") as string;
      const note = formData.get("note") as string;
      let googleMapsUrl = formData.get("googleMapsUrl") as string;
      const additionalInfo = formData.get("additionalInfoUrl") as string;
      // Extract category IDs from the hidden input before updating
      const categoryIds = JSON.parse((formData.get("category_ids") as string) || "[]");

      if (!googleMapsUrl && !isNaN(lat) && !isNaN(lng)) {
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      }

      // File input (empty selection still yields a zero-size File, handled by updatePlace)
      const file = formData.get("additionalInfoFile") as File;

      // Update the place (handles a new attachment upload, DB update and category relations,
      // and transparently queues everything for later sync if we're offline)
      const updated = await updatePlace(
        placeId as string,
        { name, trip_id, lat, lng, address, duration, note, google_maps_url: googleMapsUrl, additional_link: additionalInfo },
        file && file.size > 0 ? file : null,
        categoryIds,
        place?.attached_file ?? null
      );

      // Return to details modal and refresh map in the background
      handleBackToDetails();
      setTimeout(() => emit(AppEvent.placesUpdated), 300);

      if (updated._pendingSync) notifyPendingSync(PENDING_SYNC_MESSAGE);

    } catch (error) {
      console.error("Update error:", error);
      toast.error("Wystąpił błąd podczas aktualizacji.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to interactively find coordinates based on name and address inputs
  const handleAutoSearch = async () => {
    const name = nameRef.current?.value || "";
    const address = addressRef.current?.value || "";

    // Build query from both fields for better context
    const query = `${name} ${address}`.trim();
    if (!query) {
      setSearchError("Wpisz nazwę lub adres, aby wyszukać.");
      setSearchResults([]);
      return;
    }

    setIsSearchingCoords(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const provider = new OpenStreetMapProvider();
      // We don't strip special characters here so standard address formats work better
      const results = await provider.search({ query });

      if (results && results.length > 0) {
        setSearchResults(results);
      } else {
        setSearchError("Nie znaleziono wyników. Spróbuj dopisać lub zmienić miasto w polu adresu.");
      }
    } catch (error) {
      console.error("Geosearch error:", error);
      setSearchError("Błąd połączenia z mapą. Spróbuj ponownie.");
    } finally {
      setIsSearchingCoords(false);
    }
  };

  // Function to handle the user selecting a specific result from the list
  const handleSelectResult = (result: GeoResult) => {
    if (latRef.current) latRef.current.value = result.y.toString();
    if (lngRef.current) lngRef.current.value = result.x.toString();

    // Clear search UI after successful selection
    setSearchResults([]);
    setSearchError(null);
  };

  if (modalType !== "edit-place") return null;

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

  return (
    <Modal onClose={handleCloseToMap} title="Edytuj miejsce" maxWidth="max-w-xl" zIndex="z-[60]">
      {isLoading ? (
        <p className="text-center p-6 text-base-content/60">Ładowanie danych...</p>
      ) : (
        <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4 flex flex-col p-6 pt-4">

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Nazwa miejsca *</label>
            <input ref={nameRef} type="text" name="name" required defaultValue={place?.name} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Zakładka *</label>
            <select
              name="trip_id"
              required
              defaultValue={place?.trip_id ?? ""}
              className="select select-bordered w-full bg-base-100 border-base-300 text-base-content"
            >
              <option value="">-- Wybierz zakładkę --</option>
              {renderOptions(null, 0)}
            </select>
          </div>

          {/* Coordinates Section with Smart Geosearch Button */}
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-base-content/80">Współrzędne (Lat / Lng) *</label>
              <button
                type="button"
                onClick={handleAutoSearch}
                disabled={isSearchingCoords}
                className="text-xs bg-warning/15 hover:bg-warning/25 text-warning font-bold py-1.5 px-3 rounded flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                title="Pobierz z OpenStreetMap na podstawie nazwy i adresu"
              >
                {isSearchingCoords ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Szukam...
                  </>
                ) : (
                  <>
                    <MapPin size={14} /> Znajdź na mapie
                  </>
                )}
              </button>
            </div>

            {/* Inline Error UI (replaces system alerts) */}
            {searchError && (
              <div className="bg-error/15 text-error text-xs p-2.5 rounded-lg border border-error/40 mb-1 flex justify-between items-center animate-in fade-in">
                <span>{searchError}</span>
                <button type="button" onClick={() => setSearchError(null)} className="text-error hover:text-error/70 cursor-pointer leading-none ml-2">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Interactive Search Results List */}
            {searchResults.length > 0 && (
              <div className="bg-base-100 border border-base-300 rounded-lg shadow-md max-h-48 overflow-y-auto mb-2 z-10 flex flex-col animate-in fade-in zoom-in duration-150">
                <div className="bg-base-200 p-2 text-xs font-bold text-base-content/60 border-b border-base-300 flex justify-between items-center sticky top-0">
                  <span>Wybierz właściwe miejsce ({searchResults.length}):</span>
                  <button type="button" onClick={() => setSearchResults([])} className="text-base-content/50 hover:text-base-content cursor-pointer leading-none">
                    <X size={14} />
                  </button>
                </div>
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="text-left p-2.5 text-xs text-base-content/80 hover:bg-warning/10 border-b border-base-300 last:border-0 cursor-pointer transition-colors"
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-4">
              <div className="flex-1">
                <input ref={latRef} type="text" name="lat" required defaultValue={place?.lat || ""} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" placeholder="np. 52.229" />
              </div>
              <div className="flex-1">
                <input ref={lngRef} type="text" name="lng" required defaultValue={place?.lng || ""} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" placeholder="np. 21.012" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Adres</label>
            <input ref={addressRef} type="text" name="address" defaultValue={place?.address ?? ""} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" placeholder="Opcjonalnie (pomaga w wyszukiwaniu)" />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Szacowany czas</label>
            <input type="text" name="duration" defaultValue={place?.duration ?? ""} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Notatka</label>
            <textarea name="note" rows={3} defaultValue={place?.note ?? ""} className="textarea textarea-bordered w-full bg-base-100 border-base-300 text-base-content resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Tagi / Kategorie</label>
            <TagSelector initialSelected={initialCategories} />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Google Maps URL</label>
            <input type="url" name="googleMapsUrl" defaultValue={place?.google_maps_url ?? ""} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Strona WWW</label>
            <input type="url" name="additionalInfoUrl" defaultValue={place?.additional_link ?? ""} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary mb-4" />

            <label className="block text-sm font-medium text-base-content/80 mb-1">Załącznik</label>

            {/* Show current attachment link with decoded filename */}
            {place?.attached_file && (
              <div className="mb-2 text-sm text-base-content/70 bg-base-100 p-2 rounded border border-base-300 flex items-center gap-2">
                <span className="font-medium">Aktualny:</span>
                <a href={place.attached_file} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate" title="Otwórz plik">
                  {decodeURIComponent(place.attached_file.split('/').pop() || "Otwórz podgląd")}
                </a>
              </div>
            )}

            <input type="file" name="additionalInfoFile" accept=".pdf,image/*" className="block w-full text-sm text-base-content/60 file:mr-4 file:py-2 file:px-4 file:font-semibold file:bg-primary/15 file:text-primary file:border-0 file:rounded-full hover:file:bg-primary/25 cursor-pointer mt-1" />
            <p className="text-xs text-muted mt-1">Wybierz nowy plik, aby nadpisać stary.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4 pt-2">
            <Button type="button" variant="secondary" onClick={handleBackToDetails} className="flex-1">
              Anuluj
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting} className="flex-[2]">
              {isSubmitting ? "Zapisywanie..." : "Zapisz zmiany"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
