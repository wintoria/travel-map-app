"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import IconPicker from "@/components/tags/IconPicker";
import { childrenOf } from "@/lib/tree";
import { AppEvent, emit } from "@/lib/events";
import { closeModal } from "@/lib/url";
import { fetchTripsBasic, createTrip } from "@/lib/api/trips";
import { PENDING_SYNC_MESSAGE } from "@/lib/offline/network";
import { notifyPendingSync } from "@/lib/toast";
import toast from "react-hot-toast";
import type { Trip } from "@/lib/types";

type TripOption = Pick<Trip, "id" | "name" | "icon" | "parent_id">;

export default function AddTripModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modalType = searchParams.get("modal");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [icon, setIcon] = useState("");

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

      const trip = await createTrip({
        name,
        icon: icon || null,
        parent_id: parentId || null,
      });

      // Close modal and dispatch event to refresh the Sidebar
      emit(AppEvent.tripsUpdated);
      handleClose();

      if (trip._pendingSync) notifyPendingSync(PENDING_SYNC_MESSAGE);

    } catch (error) {
      console.error("Insert error:", error);
      toast.error("Wystąpił błąd podczas dodawania zakładki.");
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
          {"   ".repeat(level)}
          {level > 0 ? "└ " : ""}
          {child.name}
        </option>
        {/* Recursively call for children of this child */}
        {renderOptions(child.id, level + 1)}
      </React.Fragment>
    ));
  };

  return (
    <Modal onClose={handleClose} title="Nowa zakładka" maxWidth="max-w-sm" zIndex="z-[70]">
      <form onSubmit={handleSubmit} className="p-5 flex flex-col space-y-4">
        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Nazwa *</label>
          <input type="text" name="name" required placeholder="np. Wakacje 2026" className="input input-bordered w-full bg-base-100 border-base-300 text-base-content focus:border-primary" />
        </div>

        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Ikona</label>
          <input type="hidden" name="icon" value={icon} />
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <div>
          <label className="block text-sm font-medium text-base-content/80 mb-1">Folder nadrzędny (opcjonalnie)</label>
          <select name="parentId" className="select select-bordered w-full bg-base-100 border-base-300 text-base-content">
            <option value="">-- Brak (Katalog główny) --</option>
            {renderOptions(null, 0)}
          </select>
          <p className="text-xs text-muted mt-1">Możesz zagnieżdżać zakładki nieskończenie (np. Wakacje -&gt; Holandia -&gt; Amsterdam).</p>
        </div>

        <div className="pt-2 flex gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
            Anuluj
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} className="flex-[2]">
            {isSubmitting ? "Zapisywanie..." : "Dodaj zakładkę"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
