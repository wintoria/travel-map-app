import { supabase } from "@/lib/supabase";
import type { Place, Category } from "@/lib/types";
import { uploadAttachment } from "@/lib/api/storage";
import { isNetworkError, isOffline } from "@/lib/offline/network";
import {
  cachePlaces,
  getCachedPlaces,
  upsertCachedPlace,
  removeCachedPlace,
  getCachedTrips,
  getCachedCategories,
  getCachedPlaceCategories,
  setCachedPlaceCategoriesForPlace,
  removeCachedPlaceCategoriesForPlace,
} from "@/lib/offline/cache";
import { applyPlaceFilters } from "@/lib/offline/placeFilter";
import { storePendingFile, previewUrlForPendingFile } from "@/lib/offline/files";
import { enqueueOperation } from "@/lib/offline/queue";

export interface PlaceFilters {
  trips?: string | null; // comma-separated trip NAMES, or "none"
  tags?: string | null; // comma-separated category NAMES
  query?: string | null; // free-text search
  isEmpty?: boolean; // true = nothing selected, return no places
}

// Shared place-filtering query used by both the map markers and the list view.
// Fetches only places with coordinates, then narrows by text search, trip and tag filters.
// Returns [] when the selection is explicitly empty or no rows match a filter stage.
// Falls back to the local IndexedDB mirror (via applyPlaceFilters) when offline.
export async function fetchFilteredPlaces(filters: PlaceFilters): Promise<Place[]> {
  const { trips, tags, query: searchParam, isEmpty } = filters;

  if (isEmpty) return [];
  if (isOffline()) return offlineFilteredPlaces(filters);

  let query = supabase
    .from("places")
    .select("*")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("created_at", { ascending: false });

  // Text search across name / address / note.
  if (searchParam) {
    query = query.or(
      `name.ilike.%${searchParam}%,address.ilike.%${searchParam}%,note.ilike.%${searchParam}%`
    );
  }

  // Trip filter: resolve names -> ids.
  if (trips && trips !== "none") {
    const tripNames = trips.split(",");
    const { data: tripsData, error: tripsError } = await supabase.from("trips").select("id, name");
    if (tripsError) {
      if (isNetworkError(tripsError)) return offlineFilteredPlaces(filters);
    } else if (tripsData) {
      const tripIds = tripsData.filter((t) => tripNames.includes(t.name)).map((t) => t.id);
      if (tripIds.length === 0) return [];
      query = query.in("trip_id", tripIds);
    }
  }

  // Tag filter: resolve names -> ids -> place ids via place_categories.
  if (tags) {
    const tagNames = tags.split(",");
    const { data: catData, error: catError } = await supabase.from("categories").select("id, name");
    if (catError) {
      if (isNetworkError(catError)) return offlineFilteredPlaces(filters);
    } else if (catData) {
      const tagIds = catData.filter((c) => tagNames.includes(c.name)).map((c) => c.id);
      if (tagIds.length > 0) {
        const { data: pcData, error: pcError } = await supabase
          .from("place_categories")
          .select("place_id")
          .in("category_id", tagIds);
        if (pcError) {
          if (isNetworkError(pcError)) return offlineFilteredPlaces(filters);
        } else if (pcData && pcData.length > 0) {
          query = query.in(
            "id",
            pcData.map((pc) => pc.place_id)
          );
        } else {
          return [];
        }
      }
    }
  }

  const { data, error } = await query;
  if (error) {
    if (isNetworkError(error)) return offlineFilteredPlaces(filters);
    console.error("Fetch places error:", error);
    return [];
  }
  const places = (data as Place[]) || [];
  void cachePlaces(places);
  return places;
}

async function offlineFilteredPlaces(filters: PlaceFilters): Promise<Place[]> {
  const [places, trips, categories, placeCategories] = await Promise.all([
    getCachedPlaces(),
    getCachedTrips(),
    getCachedCategories(),
    getCachedPlaceCategories(),
  ]);
  return applyPlaceFilters(places, filters, trips, categories, placeCategories);
}

// Read filter values from a CustomEvent detail (fast path) falling back to the URL query string.
export function resolvePlaceFilters(event?: Event): PlaceFilters {
  const detail = (event as CustomEvent)?.detail as
    | { trips?: string; tags?: string; query?: string; isEmpty?: boolean }
    | undefined;
  const params = new URLSearchParams(window.location.search);
  const trips = detail?.trips ?? params.get("trips");
  const tags = detail?.tags ?? params.get("tags");
  const query = detail?.query ?? params.get("q");
  const isEmpty = detail ? !!detail.isEmpty : trips === "none";
  return { trips, tags, query, isEmpty };
}

// Full, unfiltered place list — used to keep the offline IndexedDB mirror warm regardless of the
// currently active filter (see PlaceList/PlacesMarkers' fire-and-forget call on mount).
export async function fetchAllPlaces(): Promise<Place[]> {
  if (isOffline()) return getCachedPlaces();
  const { data, error } = await supabase.from("places").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Fetch all places error:", error);
    return getCachedPlaces();
  }
  const places = (data as Place[]) || [];
  void cachePlaces(places);
  return places;
}

// A single canonical row straight from the server — used to reconcile the local cache after a
// queued write loses a last-write-wins conflict (see queue.ts).
export async function fetchPlaceRemoteById(id: string): Promise<Place | null> {
  const { data } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
  return (data as Place | null) ?? null;
}

// Places missing coordinates ("pending" list in the sidebar).
export async function fetchPendingPlaces(): Promise<Pick<Place, "id" | "name" | "note">[]> {
  if (isOffline()) {
    const cached = await getCachedPlaces();
    return cached.filter((p) => p.lat === null).map(({ id, name, note }) => ({ id, name, note }));
  }
  const { data, error } = await supabase
    .from("places")
    .select("id, name, note")
    .is("lat", null)
    .order("created_at", { ascending: false });

  if (error) {
    if (!isNetworkError(error)) return [];
    const cached = await getCachedPlaces();
    return cached.filter((p) => p.lat === null).map(({ id, name, note }) => ({ id, name, note }));
  }
  return data || [];
}

// A place plus its category relations, as fetched for the edit form.
export type EditPlace = Place & { place_categories?: { category_id: string }[] };

async function offlinePlaceWithCategories(id: string): Promise<EditPlace | null> {
  const [places, placeCategories] = await Promise.all([getCachedPlaces(), getCachedPlaceCategories()]);
  const place = places.find((p) => p.id === id);
  if (!place) return null;
  return {
    ...place,
    place_categories: placeCategories.filter((pc) => pc.place_id === id).map((pc) => ({ category_id: pc.category_id })),
  };
}

export async function fetchPlaceWithCategories(id: string): Promise<EditPlace | null> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  if (isOffline()) return offlinePlaceWithCategories(realId);

  const { data, error } = await supabase
    .from("places")
    .select(`*, place_categories ( category_id )`)
    .eq("id", realId)
    .single();

  if (error) {
    if (!isNetworkError(error)) return null;
    return offlinePlaceWithCategories(realId);
  }
  return data as EditPlace;
}

// A place enriched with its trip and flattened tag list, for the view-details modal.
export type PlaceDetails = Place & {
  trip?: { name: string; icon: string | null } | null;
  tags?: Category[];
};

export async function fetchPlaceDetails(id: string): Promise<PlaceDetails | null> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  if (isOffline()) return offlinePlaceDetails(realId);

  const { data, error } = await supabase
    .from("places")
    .select(`*, place_categories ( categories (*) )`)
    .eq("id", realId)
    .single();

  if (error) {
    if (!isNetworkError(error)) {
      console.error("Error fetching place details:", error);
      return null;
    }
    return offlinePlaceDetails(realId);
  }

  const row = data as Place & { place_categories?: { categories: Category | null }[] };
  const details: PlaceDetails = { ...row };

  if (row.trip_id) {
    const { data: tripData } = await supabase.from("trips").select("name, icon").eq("id", row.trip_id).single();
    details.trip = tripData ?? null;
  }

  if (row.place_categories) {
    details.tags = row.place_categories
      .map((pc) => pc.categories)
      .filter((c): c is Category => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return details;
}

async function offlinePlaceDetails(id: string): Promise<PlaceDetails | null> {
  const [places, trips, categories, placeCategories] = await Promise.all([
    getCachedPlaces(),
    getCachedTrips(),
    getCachedCategories(),
    getCachedPlaceCategories(),
  ]);
  const place = places.find((p) => p.id === id);
  if (!place) return null;

  const trip = place.trip_id ? trips.find((t) => t.id === place.trip_id) ?? null : null;
  const tagIds = placeCategories.filter((pc) => pc.place_id === id).map((pc) => pc.category_id);
  const tags = categories.filter((c) => tagIds.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));

  return { ...place, trip: trip ? { name: trip.name, icon: trip.icon } : null, tags };
}

// ---- mutations ----
//
// Each has an online/offline branch: the live Supabase call is always attempted first, and only a
// genuine network failure (isNetworkError) falls back to an optimistic cache write + queued replay
// (see lib/offline/queue.ts). A non-network error (RLS/validation) is thrown as before.
//
// Conflict resolution: every row carries `updated_at`, set by the CLIENT to the moment the edit was
// made (not when it happened to sync) — captured up front so an edit made offline keeps its true
// timestamp no matter how late it eventually syncs. Every update/delete is a conditional write
// (`.lt("updated_at", editedAt)`) — if another device already wrote something newer, ours loses and
// is dropped instead of clobbering it. This is plain last-write-wins by wall-clock time, not a CRDT:
// it does not merge concurrent edits to different fields, and it trusts each device's clock.
//
// IDs are generated client-side (crypto.randomUUID()) up front, for both online and offline creates,
// and the create is a Postgres upsert keyed on that id. That makes a create idempotent: if a queued
// create is replayed twice (a tab crash between the insert succeeding and the queue entry being
// deleted, or two tabs flushing the same queue at once), the second attempt overwrites the same row
// instead of inserting a duplicate.

export interface NewPlaceInput {
  trip_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  duration: string;
  note: string;
  google_maps_url: string;
  visited: boolean;
  additional_link: string;
}

// Pure network operation, no cache side effects — reused by createPlace()'s online path and by
// queue.ts's replay of a queued offline create. Idempotent: upserts by the caller-supplied id, and
// replaces (rather than appends to) the category relations, so a duplicate replay is a safe no-op.
export async function createPlaceRemote(
  id: string,
  input: NewPlaceInput & { attached_file: string | null },
  categoryIds: string[],
  editedAt: string
): Promise<Place> {
  const { data: newPlace, error: dbError } = await supabase
    .from("places")
    .upsert(
      {
        id,
        trip_id: input.trip_id,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        address: input.address,
        duration: input.duration,
        note: input.note,
        google_maps_url: input.google_maps_url,
        visited: input.visited,
        additional_link: input.additional_link,
        attached_file: input.attached_file,
        updated_at: editedAt,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (dbError) throw dbError;
  const place = newPlace as Place;

  const { error: delError } = await supabase.from("place_categories").delete().eq("place_id", place.id);
  if (delError) throw delError;

  if (categoryIds.length > 0) {
    const relations = categoryIds.map((category_id) => ({ place_id: place.id, category_id }));
    const { error: relError } = await supabase.from("place_categories").insert(relations);
    if (relError) throw relError;
  }

  return place;
}

export async function createPlace(input: NewPlaceInput, file: File | null, categoryIds: string[]): Promise<Place> {
  const id = crypto.randomUUID();
  const editedAt = new Date().toISOString();

  try {
    let attached_file: string | null = null;
    if (file && file.size > 0) {
      attached_file = await uploadAttachment(file);
    }
    const place = await createPlaceRemote(id, { ...input, attached_file }, categoryIds, editedAt);
    void upsertCachedPlace(place);
    void setCachedPlaceCategoriesForPlace(place.id, categoryIds);
    return place;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    let fileRef: string | undefined;
    let attached_file: string | null = null;
    if (file && file.size > 0) {
      fileRef = await storePendingFile(file);
      attached_file = await previewUrlForPendingFile(fileRef);
    }

    const optimisticPlace: Place = {
      id,
      created_at: editedAt,
      updated_at: editedAt,
      trip_id: input.trip_id,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      duration: input.duration,
      note: input.note,
      google_maps_url: input.google_maps_url,
      visited: input.visited,
      additional_link: input.additional_link,
      attached_file,
      _pendingSync: true,
    };

    await upsertCachedPlace(optimisticPlace);
    await setCachedPlaceCategoriesForPlace(id, categoryIds);
    await enqueueOperation({
      entity: "place",
      kind: "create",
      targetId: id,
      payload: { ...input, categoryIds, editedAt },
      fileRef,
    });

    return optimisticPlace;
  }
}

export interface UpdatePlaceInput {
  trip_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  duration: string;
  note: string;
  google_maps_url: string;
  additional_link: string;
}

// Conditional update keyed on updated_at: returns null when a newer edit already won (this write is
// dropped, not applied) instead of blindly overwriting whatever is on the server.
export async function updatePlaceRemote(
  id: string,
  input: UpdatePlaceInput & { attached_file: string | null },
  categoryIds: string[],
  editedAt: string
): Promise<Place | null> {
  const { data, error: dbError } = await supabase
    .from("places")
    .update({
      name: input.name,
      trip_id: input.trip_id,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      duration: input.duration,
      note: input.note,
      google_maps_url: input.google_maps_url,
      additional_link: input.additional_link,
      attached_file: input.attached_file,
      updated_at: editedAt,
    })
    .eq("id", id)
    .lt("updated_at", editedAt)
    .select();

  if (dbError) throw dbError;
  if (!data || data.length === 0) return null; // superseded by a newer edit (or the row is gone)

  const place = data[0] as Place;

  const { error: delError } = await supabase.from("place_categories").delete().eq("place_id", id);
  if (delError) throw delError;

  if (categoryIds.length > 0) {
    const relations = categoryIds.map((category_id) => ({ place_id: id, category_id }));
    const { error: insError } = await supabase.from("place_categories").insert(relations);
    if (insError) throw insError;
  }

  return place;
}

// Reconciles the local cache with whatever actually won a lost conflict, rather than leaving our
// (now-wrong) optimistic write in place. Returns the winning row (or null if it was actually deleted).
async function reconcileSupersededPlace(id: string): Promise<void> {
  const current = await fetchPlaceRemoteById(id);
  if (current) {
    await upsertCachedPlace(current);
  } else {
    await removeCachedPlace(id);
    await removeCachedPlaceCategoriesForPlace(id);
  }
}

export async function updatePlace(
  id: string,
  input: UpdatePlaceInput,
  file: File | null,
  categoryIds: string[],
  existingAttachedFile: string | null
): Promise<Place> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const editedAt = new Date().toISOString();

  try {
    let attached_file = existingAttachedFile;
    if (file && file.size > 0) {
      attached_file = await uploadAttachment(file);
    }
    const place = await updatePlaceRemote(realId, { ...input, attached_file }, categoryIds, editedAt);
    if (!place) {
      // Someone else's newer edit already won — keep their version in the cache, but tell the
      // caller this edit did NOT apply (don't let the UI close/report success as if it had).
      await reconcileSupersededPlace(realId);
      throw new Error("To miejsce zostało w międzyczasie zmienione na innym urządzeniu — Twoja zmiana nie została zapisana.");
    }
    void upsertCachedPlace(place);
    void setCachedPlaceCategoriesForPlace(place.id, categoryIds);
    return place;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    let fileRef: string | undefined;
    let attached_file = existingAttachedFile;
    if (file && file.size > 0) {
      fileRef = await storePendingFile(file);
      attached_file = await previewUrlForPendingFile(fileRef);
    }

    const cached = await getCachedPlaces();
    const existing = cached.find((p) => p.id === realId);
    const optimisticPlace: Place = {
      id: realId,
      created_at: existing?.created_at ?? editedAt,
      updated_at: editedAt,
      visited: existing?.visited ?? null,
      trip_id: input.trip_id,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      duration: input.duration,
      note: input.note,
      google_maps_url: input.google_maps_url,
      additional_link: input.additional_link,
      attached_file,
      _pendingSync: true,
    };

    await upsertCachedPlace(optimisticPlace);
    await setCachedPlaceCategoriesForPlace(realId, categoryIds);
    // When no new file was picked, carry the resolved "keep old attachment" URL explicitly — the
    // replay step has no other way to know it (attached_file isn't part of UpdatePlaceInput).
    const payload: Record<string, unknown> = { ...input, categoryIds, editedAt };
    if (!fileRef) payload.attached_file = existingAttachedFile;
    await enqueueOperation({ entity: "place", kind: "update", targetId: realId, payload, fileRef });

    return optimisticPlace;
  }
}

// Applies a partial field patch (visited toggle, geocoded coords) without touching categories or
// attachments — the replay counterpart used by queue.ts for updatePlaceVisited/updatePlaceCoords.
// Same conditional-update conflict handling as updatePlaceRemote.
export async function patchPlaceRemote(
  id: string,
  fields: Partial<Pick<Place, "visited" | "lat" | "lng">>,
  editedAt: string
): Promise<Place | null> {
  const { data, error } = await supabase
    .from("places")
    .update({ ...fields, updated_at: editedAt })
    .eq("id", id)
    .lt("updated_at", editedAt)
    .select();
  if (error) throw error;
  return data && data.length > 0 ? (data[0] as Place) : null;
}

export async function updatePlaceVisited(id: string, visited: boolean): Promise<void> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const editedAt = new Date().toISOString();
  try {
    const place = await patchPlaceRemote(realId, { visited }, editedAt);
    if (!place) {
      // Someone else's newer edit already won — restore the cache to their version and tell the
      // caller this toggle did NOT apply, so its optimistic UI reverts instead of showing our guess.
      await reconcileSupersededPlace(realId);
      throw new Error("To miejsce zostało w międzyczasie zmienione na innym urządzeniu.");
    }
    void upsertCachedPlace(place);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const cached = await getCachedPlaces();
    const existing = cached.find((p) => p.id === realId);
    if (existing) await upsertCachedPlace({ ...existing, visited, updated_at: editedAt, _pendingSync: true });
    await enqueueOperation({ entity: "place", kind: "update", targetId: realId, payload: { visited, editedAt } });
  }
}

// Returns false when the delete was skipped because a newer edit exists server-side (conflict:
// someone edited this place after we deleted it locally — their edit wins, the place is kept).
export async function deletePlaceRemote(id: string, deletedAt: string): Promise<boolean> {
  const { data, error } = await supabase.from("places").delete().eq("id", id).lt("updated_at", deletedAt).select();
  if (error) throw error;
  return !!(data && data.length > 0);
}

export async function deletePlace(id: string): Promise<{ error: unknown }> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const deletedAt = new Date().toISOString();
  try {
    const deleted = await deletePlaceRemote(realId, deletedAt);
    if (deleted) {
      void removeCachedPlace(realId);
      void removeCachedPlaceCategoriesForPlace(realId);
      return { error: null };
    }
    // Superseded: someone edited this place after our delete fired — keep their newer version and
    // tell the caller the delete did NOT happen (don't let the UI close as if it succeeded).
    await reconcileSupersededPlace(realId);
    return { error: new Error("Place was edited elsewhere after this delete — kept the newer version.") };
  } catch (err) {
    if (!isNetworkError(err)) return { error: err };
    // Optimistic locally; reconciled against whatever wins if this turns out to be superseded too.
    await removeCachedPlace(realId);
    await removeCachedPlaceCategoriesForPlace(realId);
    await enqueueOperation({ entity: "place", kind: "delete", targetId: realId, payload: { deletedAt } });
    return { error: null };
  }
}

export async function updatePlaceCoords(id: string, lat: number, lng: number): Promise<{ error: unknown }> {
  const realId = id; // ids are stable from creation now (client-generated) — no remapping needed
  const editedAt = new Date().toISOString();
  try {
    const place = await patchPlaceRemote(realId, { lat, lng }, editedAt);
    if (!place) {
      // Superseded — keep the newer version in cache and tell the caller this write didn't apply.
      await reconcileSupersededPlace(realId);
      return { error: new Error("Place was edited elsewhere after these coordinates were resolved.") };
    }
    void upsertCachedPlace(place);
    return { error: null };
  } catch (err) {
    if (!isNetworkError(err)) return { error: err };
    const cached = await getCachedPlaces();
    const existing = cached.find((p) => p.id === realId);
    if (existing) await upsertCachedPlace({ ...existing, lat, lng, updated_at: editedAt, _pendingSync: true });
    await enqueueOperation({ entity: "place", kind: "update", targetId: realId, payload: { lat, lng, editedAt } });
    return { error: null };
  }
}

// Bulk CSV/JSON import (Google Takeout). Deliberately NOT offline-queued — per-row conflict handling
// doesn't map cleanly onto a bulk upsert; ImportModal guards this with a navigator.onLine check instead.
export async function bulkUpsertPlaces(rows: Record<string, unknown>[], onConflict: string) {
  const stamped = rows.map((row) => ({ ...row, updated_at: new Date().toISOString() }));
  return supabase.from("places").upsert(stamped, { onConflict, ignoreDuplicates: false });
}
