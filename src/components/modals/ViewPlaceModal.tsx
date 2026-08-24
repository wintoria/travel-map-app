"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Globe, Paperclip, Bookmark } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { getContrastColor, effectiveTagColor } from "@/lib/color";
import { deletePlace, fetchPlaceDetails, updatePlaceVisited, type PlaceDetails } from "@/lib/api/places";
import { AppEvent, emit } from "@/lib/events";
import { closeModal, openModal } from "@/lib/url";
import { isOffline, PENDING_SYNC_MESSAGE } from "@/lib/offline/network";
import { notifyPendingSync } from "@/lib/toast";
import toast from "react-hot-toast";
import type { Category } from "@/lib/types";

export default function ViewPlaceModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get URL parameters
  const modalType = searchParams.get("modal");
  const placeId = searchParams.get("placeId");

  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    // Only fetch if this specific modal is active
    if (modalType !== "view-place" || !placeId) return;

    const loadPlaceDetails = async () => {
      setIsLoading(true);
      const details = await fetchPlaceDetails(placeId);
      setPlace(details);
      setIsLoading(false);
    };

    loadPlaceDetails();
  }, [modalType, placeId]);

  // Close modal by clearing URL parameters
  const handleClose = () => closeModal(router, ["placeId"]);

  // Delete place and notify map
  const handleDeleteConfirm = async () => {
    if (!place) return;
    setIsLoading(true);
    const { error } = await deletePlace(place.id);

    if (!error) {
      emit(AppEvent.placesUpdated); // Refresh map markers
      handleClose(); // Close modal quietly
      if (isOffline()) notifyPendingSync(PENDING_SYNC_MESSAGE);
    } else {
      console.error("Delete error:", error);
      toast.error("Nie udało się usunąć miejsca.");
      setIsLoading(false);
    }
  };

  // Do not render if the modal type does not match
  if (modalType !== "view-place") return null;

  // Toggle the visited status directly from the view modal
  const handleToggleVisited = async () => {
    if (!place) return;
    const newStatus = !place.visited;

    // Optimistic UI update (feels instant)
    setPlace({ ...place, visited: newStatus });

    try {
      await updatePlaceVisited(place.id, newStatus);
      emit(AppEvent.placesUpdated);
      if (isOffline()) notifyPendingSync(PENDING_SYNC_MESSAGE);
    } catch (error) {
      // Revert if the update fails (a conflict — someone else's newer edit already won)
      setPlace({ ...place, visited: !newStatus });
      console.error("Failed to toggle visited status", error);
      toast.error("Nie udało się zaktualizować statusu — zmieniono w międzyczasie na innym urządzeniu.");
    }
  };

  return (
    <Modal onClose={handleClose} title="Szczegóły miejsca" maxWidth="max-w-md" zIndex="z-[9999]">
      {/* Modal Body */}
      <div className="p-6 overflow-y-auto">
        {isLoading ? (
          <p className="text-center text-base-content/60">Ładowanie danych...</p>
        ) : place ? (
          <div className="space-y-4">

            {/* Title, Address and Interactive Visited Badge */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold text-base-content">{place.name}</h3>

                {/* Interactive toggle button */}
                <button
                  onClick={handleToggleVisited}
                  className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shrink-0 transition-colors cursor-pointer border ${
                    place.visited
                      ? 'bg-success/20 text-success border-success/40 hover:bg-success/30'
                      : 'bg-base-300 text-base-content/60 border-base-300 hover:bg-base-300/70'
                  }`}
                >
                  {place.visited ? "Odwiedzone" : "Nieodwiedzone"}
                </button>
              </div>

              {/* Bookmark Badge */}
              {place.trip && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 bg-info/15 text-info text-xs font-bold rounded-md border border-info/30">
                  {place.trip.icon ? <span>{place.trip.icon}</span> : <Bookmark size={14} />}
                  <span>{place.trip.name}</span>
                </div>
              )}

              {/* Display Tags / Categories */}
              {place.tags && place.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {place.tags.map((tag: Category) => {
                    const effectiveColor = effectiveTagColor(tag.color);

                    return (
                      <span
                        key={tag.id}
                        title={tag.name}
                        style={{
                          backgroundColor: effectiveColor,
                          color: getContrastColor(effectiveColor),
                          borderColor: effectiveColor
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm"
                      >
                        <span>{tag.icon}</span>
                        <span className="truncate max-w-[140px]">{tag.name}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {place.address && <p className="text-sm text-base-content/60 mt-2">{place.address}</p>}
            </div>

            {/* Coordinates */}
            <div className="flex gap-4 text-xs text-muted border-b border-base-300 pb-3">
              <span>Lat: {place.lat}</span>
              <span>Lng: {place.lng}</span>
            </div>

            {/* Duration */}
            {place.duration && (
              <div className="text-sm text-base-content/80">
                <span className="font-semibold">Szacowany czas:</span> {place.duration}
              </div>
            )}

            {/* Note */}
            {place.note && (
              <div className="bg-base-100 p-3 rounded-lg border border-base-300">
                <p className="text-sm text-base-content/80 whitespace-pre-wrap">{place.note}</p>
              </div>
            )}

            {/* External Links & Attachments */}
            {(place.google_maps_url || place.additional_link || place.attached_file) && (
              <div className="flex flex-col gap-2 pt-2">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Linki i załączniki</p>

                {/* Google Maps link */}
                {place.google_maps_url && (
                  <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:text-primary/80 hover:underline flex items-center gap-2">
                    <MapPin size={16} /> Otwórz w Google Maps
                  </a>
                )}

                {/* Website link */}
                {place.additional_link && (
                  <a href={place.additional_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:text-primary/80 hover:underline flex items-center gap-2">
                    <Globe size={16} /> Strona internetowa
                  </a>
                )}

                {/* Uploaded File link */}
                {place.attached_file && (
                  <a href={place.attached_file} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:text-primary/80 hover:underline flex items-center gap-2">
                    <Paperclip size={16} /> Otwórz załącznik
                  </a>
                )}
              </div>
            )}

            {/* Action Buttons (Edit / Delete / Confirm) */}
            <div className="pt-4 mt-2 border-t border-base-300">
              {showDeleteConfirm ? (
                <div className="bg-error/15 p-3 rounded-lg flex flex-col items-center animate-in fade-in zoom-in duration-200">
                  <p className="text-sm text-error font-medium mb-3">Czy na pewno chcesz usunąć to miejsce?</p>
                  <div className="flex gap-2 w-full">
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1" type="button">
                      Anuluj
                    </Button>
                    <Button variant="danger-solid" onClick={handleDeleteConfirm} className="flex-1" type="button">
                      Tak, usuń
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => openModal(router, "edit-place")} className="flex-1 text-sm" type="button">
                    Edytuj
                  </Button>
                  <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} className="flex-1 text-sm" type="button">
                    Usuń
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-error">Nie znaleziono miejsca.</p>
        )}
      </div>
    </Modal>
  );
}
