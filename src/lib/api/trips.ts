import { supabase } from "@/lib/supabase";
import type { Trip } from "@/lib/types";
import { isNetworkError } from "@/lib/offline/network";
import { cacheTrips, getCachedTrips, upsertCachedTrip, removeCachedTrip, removeCachedTripCascade } from "@/lib/offline/cache";
import { enqueueOperation } from "@/lib/offline/queue";

// Full trip rows ordered by creation (sidebar tree, dropdowns).
export async function fetchTrips(): Promise<Trip[]> {
  const { data, error } = await supabase.from("trips").select("*").order("created_at", { ascending: true });
  if (error) {
    if (!isNetworkError(error)) return [];
    return getCachedTrips();
  }
  const trips = (data as Trip[]) || [];
  void cacheTrips(trips);
  return trips;
}

// Lightweight id/name/icon rows for dropdowns and grouping headers.
export async function fetchTripsBasic(): Promise<Pick<Trip, "id" | "name" | "icon" | "parent_id">[]> {
  const { data, error } = await supabase.from("trips").select("id, name, icon, parent_id");
  if (error) {
    if (!isNetworkError(error)) return [];
    return getCachedTrips();
  }
  return data || [];
}

// A single canonical row straight from the server — used to reconcile the local cache after a
// queued write loses a last-write-wins conflict (see queue.ts).
export async function fetchTripRemoteById(id: string): Promise<Trip | null> {
  const { data } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  return (data as Trip | null) ?? null;
}

async function reconcileSupersededTrip(id: string): Promise<void> {
  const current = await fetchTripRemoteById(id);
  if (current) {
    await upsertCachedTrip(current);
  } else {
    await removeCachedTrip(id);
  }
}

export interface TripInput {
  name: string;
  icon: string | null;
  parent_id: string | null;
}

// Idempotent: upserts by the caller-supplied id, so a duplicate replay (tab crash, two tabs syncing
// at once) overwrites the same row instead of inserting a second one.
export async function createTripRemote(id: string, input: TripInput, editedAt: string): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .upsert({ id, ...input, updated_at: editedAt }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function createTrip(input: TripInput): Promise<Trip> {
  const id = crypto.randomUUID();
  const editedAt = new Date().toISOString();
  try {
    const trip = await createTripRemote(id, input, editedAt);
    void upsertCachedTrip(trip);
    return trip;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    const optimisticTrip: Trip = { id, created_at: editedAt, updated_at: editedAt, ...input, _pendingSync: true };
    await upsertCachedTrip(optimisticTrip);
    await enqueueOperation({ entity: "trip", kind: "create", targetId: id, payload: { ...input, editedAt } });
    return optimisticTrip;
  }
}

// Conditional update: returns null when a newer edit (from another device) already won.
export async function updateTripRemote(id: string, input: TripInput, editedAt: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("trips")
    .update({ ...input, updated_at: editedAt })
    .eq("id", id)
    .lt("updated_at", editedAt)
    .select();
  if (error) throw error;
  return data && data.length > 0 ? (data[0] as Trip) : null;
}

export async function updateTrip(id: string, input: TripInput): Promise<Trip> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const editedAt = new Date().toISOString();
  try {
    const trip = await updateTripRemote(realId, input, editedAt);
    if (!trip) {
      // Someone else's newer edit already won — keep their version in the cache, but tell the
      // caller this edit did NOT apply (don't let the UI close/report success as if it had).
      await reconcileSupersededTrip(realId);
      throw new Error("Ta zakładka została w międzyczasie zmieniona na innym urządzeniu — Twoja zmiana nie została zapisana.");
    }
    void upsertCachedTrip(trip);
    return trip;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    const cached = await getCachedTrips();
    const existing = cached.find((t) => t.id === realId);
    const optimisticTrip: Trip = {
      id: realId,
      created_at: existing?.created_at ?? editedAt,
      updated_at: editedAt,
      ...input,
      _pendingSync: true,
    };
    await upsertCachedTrip(optimisticTrip);
    await enqueueOperation({ entity: "trip", kind: "update", targetId: realId, payload: { ...input, editedAt } });
    return optimisticTrip;
  }
}

// Returns false when the delete was skipped because a newer edit exists server-side.
export async function deleteTripRemote(id: string, deletedAt: string): Promise<boolean> {
  const { data, error } = await supabase.from("trips").delete().eq("id", id).lt("updated_at", deletedAt).select();
  if (error) throw error;
  return !!(data && data.length > 0);
}

export async function deleteTrip(id: string): Promise<{ error: unknown }> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const deletedAt = new Date().toISOString();
  try {
    const deleted = await deleteTripRemote(realId, deletedAt);
    if (!deleted) {
      // Superseded: someone edited this trip after our delete fired — keep their newer version and
      // tell the caller the delete did NOT happen.
      await reconcileSupersededTrip(realId);
      return { error: new Error("Trip was edited elsewhere after this delete — kept the newer version.") };
    }
    return { error: null };
  } catch (err) {
    if (!isNetworkError(err)) return { error: err };

    const allTrips = await getCachedTrips();
    await removeCachedTripCascade(realId, allTrips);
    await enqueueOperation({ entity: "trip", kind: "delete", targetId: realId, payload: { deletedAt } });
    return { error: null };
  }
}
