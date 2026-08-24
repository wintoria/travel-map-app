"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import IconPicker from "@/components/tags/IconPicker";
import ColorPicker from "@/components/tags/ColorPicker";
import { autoColorForEmoji } from "@/lib/color";
import { childrenOf } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { closeModal } from "@/lib/url";
import { fetchTrips, fetchTripsBasic, updateTrip, deleteTrip } from "@/lib/api/trips";
import { isOffline, PENDING_SYNC_MESSAGE } from "@/lib/offline/network";
import { notifyPendingSync } from "@/lib/toast";
import toast from "react-hot-toast";
import type { Trip } from "@/lib/types";

type TripOption = Pick<Trip, "id" | "name" | "icon" | "parent_id">;

export default function EditTripModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modalType = searchParams.get("modal");
  const tripId = searchParams.get("tripId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [allTrips, setAllTrips] = useState<TripOption[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<string | null>(null);

  // Fetch current trip and all trips for the hierarchy dropdown
  useEffect(() => {
    if (modalType !== "edit-trip" || !tripId) return;

    const fetchData = async () => {
      setIsLoading(true);
      setShowDeleteConfirm(false);

      const trips = await fetchTrips();
      const currentTrip = trips.find((t) => t.id === tripId) ?? null;
      if (currentTrip) setTrip(currentTrip);

      const tripsData = await fetchTripsBasic();
      setAllTrips(tripsData);

      setIcon(currentTrip?.icon ?? "");
      setColor(currentTrip?.color ?? null);
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
      const color = formData.get("color") as string;
      const parentId = formData.get("parentId") as string;

      const trip = await updateTrip(tripId as string, {
        name,
        icon: icon || null,
        color: color || autoColorForEmoji(icon),
        parent_id: parentId || null,
      });

      // Refresh Sidebar and map, then close
      emit(AppEvent.tripsUpdated);
      emit(AppEvent.filtersChanged);
      handleClose();

      if (trip._pendingSync) notifyPendingSync(PENDING_SYNC_MESSAGE);
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Wystąpił błąd podczas zapisywania zakładki.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);

    // Note: If this folder has children, Supabase must have CASCADE DELETE enabled,
    // otherwise this might throw a foreign key error.
    const { error } = await deleteTrip(tripId as string);

    if (error) {
      console.error("Delete error:", error);
      toast.error("Nie można usunąć zakładki. Upewnij się, że nie zawiera innych podzakładek.");
      setIsSubmitting(false);
    } else {
      emit(AppEvent.tripsUpdated);
      emit(AppEvent.filtersChanged);
      handleClose();
      if (isOffline()) notifyPendingSync(PENDING_SYNC_MESSAGE);
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
            {"   ".repeat(level)}
            {level > 0 ? "└ " : ""}
            {child.name}
          </option>
          {renderOptions(child.id, level + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <Modal onClose={handleClose} title="Edytuj zakładkę" maxWidth="max-w-sm" zIndex="z-[70]">
      {isLoading ? (
        <p className="text-center p-6 text-base-content/60">Ładowanie...</p>
      ) : (
        <div className="p-5 flex flex-col space-y-4">

          <form id="edit-trip-form" onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Nazwa *</label>
              <input type="text" name="name" required defaultValue={trip?.name} className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Ikona</label>
              <input type="hidden" name="icon" value={icon} />
              <input type="hidden" name="color" value={color ?? ""} />
              <div className="flex items-start">
                <IconPicker
                  value={icon}
                  color={color}
                  onChange={(emoji) => {
                    setIcon(emoji);
                    setColor(null);
                  }}
                />
                <ColorPicker color={color ?? autoColorForEmoji(icon)} onChange={setColor} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-1">Folder nadrzędny</label>
              <select name="parentId" defaultValue={trip?.parent_id || ""} className="select select-bordered w-full bg-base-100 border-base-300 text-base-content">
                <option value="">-- Brak (Katalog główny) --</option>
                {renderOptions(null, 0)}
              </select>
            </div>
          </form>

          <div className="border-t border-base-300 pt-4 mt-2">
            {showDeleteConfirm ? (
              <div className="bg-error/15 p-3 rounded-lg flex flex-col items-center">
                <p className="text-sm text-error font-medium mb-3 text-center">Usunąć zakładkę i wszystkie miejsca w niej?</p>
                <div className="flex gap-2 w-full">
                  <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
                    Anuluj
                  </Button>
                  <Button type="button" variant="danger-solid" onClick={handleDelete} disabled={isSubmitting} className="flex-1">
                    Tak, usuń
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button type="button" variant="danger" onClick={() => setShowDeleteConfirm(true)} className="flex-1 text-sm">
                  Usuń
                </Button>
                <Button type="submit" form="edit-trip-form" variant="primary" disabled={isSubmitting} className="flex-[2]">
                  Zapisz
                </Button>
              </div>
            )}
          </div>

        </div>
      )}
    </Modal>
  );
}
