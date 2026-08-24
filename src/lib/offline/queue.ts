// The offline mutation queue: enqueue() is called by lib/api/* when a write fails due to being
// offline; flushQueue() replays queued ops against Supabase, in order, once connectivity returns.
import { getDB } from "./db";
import { isNetworkError } from "./network";
import { uploadPendingFile } from "./files";
import {
  upsertCachedPlace,
  removeCachedPlace,
  setCachedPlaceCategoriesForPlace,
  removeCachedPlaceCategoriesForPlace,
  upsertCachedTrip,
  removeCachedTrip,
  upsertCachedCategory,
  removeCachedCategoryCascade,
} from "./cache";
import type { QueuedOperation } from "./types";
import { AppEvent, emit } from "@/lib/events";
import type { Place } from "@/lib/types";
import {
  createPlaceRemote,
  updatePlaceRemote,
  patchPlaceRemote,
  deletePlaceRemote,
  fetchPlaceRemoteById,
  type NewPlaceInput,
  type UpdatePlaceInput,
} from "@/lib/api/places";
import {
  createTripRemote,
  updateTripRemote,
  deleteTripRemote,
  fetchTripRemoteById,
  type TripInput,
} from "@/lib/api/trips";
import {
  createCategoryRemote,
  updateCategoryRemote,
  deleteCategoryRemote,
  fetchCategoryRemoteById,
  type CategoryInput,
} from "@/lib/api/categories";

export async function enqueueOperation(op: Omit<QueuedOperation, "seq" | "createdAt">): Promise<QueuedOperation> {
  const db = await getDB();
  const fullOp: QueuedOperation = { ...op, createdAt: Date.now() };
  const seq = await db.add("mutationQueue", fullOp);
  emit(AppEvent.syncQueueChanged);
  return { ...fullOp, seq };
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count("mutationQueue");
}

let isFlushing = false;

async function runFlush(): Promise<void> {
  const db = await getDB();
  const ops = await db.getAll("mutationQueue");

  for (const op of ops) {
    try {
      await replayOperation(op);
      if (op.seq !== undefined) await db.delete("mutationQueue", op.seq);
      emit(AppEvent.syncQueueChanged);
    } catch (err) {
      if (isNetworkError(err)) {
        // Still offline (or connectivity dropped mid-flush) — stop here, retry on the next flush.
        break;
      }
      // Non-network error (RLS/validation): this op can never succeed as queued. Drop it rather
      // than blocking every later op behind a poison pill — a stated limitation of last-write-wins.
      console.error("Dropping unsyncable offline operation:", op, err);
      if (op.seq !== undefined) await db.delete("mutationQueue", op.seq);
      emit(AppEvent.syncQueueChanged);
    }
  }
}

// Sequential (never parallel) FIFO replay — a later op can depend on an id a prior op just resolved
// (e.g. a place created offline referencing a trip also created offline in the same session).
//
// Guarded two ways against running twice at once:
// - Across tabs: the Web Locks API (when available) means only one tab's flush actually runs; a tab
//   that finds the lock held just skips this attempt (ifAvailable) rather than queueing behind it —
//   the next 'online' event or eager call will retry.
// - Within a tab: the in-memory flag, both as the fallback when Web Locks isn't available and as a
//   fast local check.
//
// Belt-and-suspenders, not the only safety net: every create is an idempotent upsert-by-client-id and
// every update/delete is a conditional write keyed on updated_at, so even a genuinely concurrent
// replay (a crash between a remote write succeeding and its queue entry being deleted, or a lock-free
// browser) can't create a duplicate row or silently clobber a newer edit.
export async function flushQueue(): Promise<void> {
  if (isFlushing) return;

  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks) {
    await locks.request("travel-map-sync-queue", { ifAvailable: true }, async (lock) => {
      if (!lock) return; // another tab is already flushing
      isFlushing = true;
      try {
        await runFlush();
      } finally {
        isFlushing = false;
      }
    });
    return;
  }

  isFlushing = true;
  try {
    await runFlush();
  } finally {
    isFlushing = false;
  }
}

async function replayOperation(op: QueuedOperation): Promise<void> {
  if (op.entity === "place") {
    if (op.kind === "create") return replayPlaceCreate(op);
    if (op.kind === "update") return replayPlaceUpdate(op);
    if (op.kind === "delete") return replayPlaceDelete(op);
  } else if (op.entity === "trip") {
    if (op.kind === "create") return replayTripCreate(op);
    if (op.kind === "update") return replayTripUpdate(op);
    if (op.kind === "delete") return replayTripDelete(op);
  } else if (op.entity === "category") {
    if (op.kind === "create") return replayCategoryCreate(op);
    if (op.kind === "update") return replayCategoryUpdate(op);
    if (op.kind === "delete") return replayCategoryDelete(op);
  }
}

// ---- places ----

async function replayPlaceCreate(op: QueuedOperation): Promise<void> {
  const { categoryIds, editedAt, ...rest } = op.payload as unknown as NewPlaceInput & {
    categoryIds: string[];
    editedAt: string;
  };
  const trip_id = rest.trip_id;
  const attached_file = op.fileRef ? await uploadPendingFile(op.fileRef) : null;

  // Idempotent (upsert-by-id): safe even if this op is replayed twice (crash after a prior success,
  // or two tabs racing) — same id in, same row out, no duplicate.
  const place = await createPlaceRemote(op.targetId, { ...rest, trip_id, attached_file }, categoryIds, editedAt);

  await upsertCachedPlace(place);
  await setCachedPlaceCategoriesForPlace(place.id, categoryIds);
  emit(AppEvent.placesUpdated);
}

async function replayPlaceUpdate(op: QueuedOperation): Promise<void> {
  const realId = op.targetId;

  if ("categoryIds" in op.payload) {
    const {
      categoryIds,
      editedAt,
      attached_file: keptAttachedFile,
      ...rest
    } = op.payload as unknown as UpdatePlaceInput & {
      categoryIds: string[];
      editedAt: string;
      attached_file?: string | null;
    };
    const trip_id = rest.trip_id;
    const attached_file = op.fileRef ? await uploadPendingFile(op.fileRef) : keptAttachedFile ?? null;

    const place = await updatePlaceRemote(realId, { ...rest, trip_id, attached_file }, categoryIds, editedAt);
    if (place) {
      await upsertCachedPlace(place);
      await setCachedPlaceCategoriesForPlace(place.id, categoryIds);
    } else {
      await reconcileSupersededPlaceCache(realId);
    }
  } else {
    const { editedAt, ...fields } = op.payload as Partial<Pick<Place, "visited" | "lat" | "lng">> & {
      editedAt: string;
    };
    const place = await patchPlaceRemote(realId, fields, editedAt);
    if (place) {
      await upsertCachedPlace(place);
    } else {
      await reconcileSupersededPlaceCache(realId);
    }
  }

  emit(AppEvent.placesUpdated);
}

async function replayPlaceDelete(op: QueuedOperation): Promise<void> {
  const realId = op.targetId;
  const { deletedAt } = op.payload as { deletedAt: string };
  const deleted = await deletePlaceRemote(realId, deletedAt);
  if (deleted) {
    await removeCachedPlace(realId);
    await removeCachedPlaceCategoriesForPlace(realId);
  } else {
    // Superseded: someone edited this place after our delete fired — keep their newer version.
    await reconcileSupersededPlaceCache(realId);
  }
  emit(AppEvent.placesUpdated);
}

async function reconcileSupersededPlaceCache(id: string): Promise<void> {
  const current = await fetchPlaceRemoteById(id);
  if (current) {
    await upsertCachedPlace(current);
  } else {
    await removeCachedPlace(id);
    await removeCachedPlaceCategoriesForPlace(id);
  }
}

// ---- trips ----

async function replayTripCreate(op: QueuedOperation): Promise<void> {
  const { editedAt, ...input } = op.payload as unknown as TripInput & { editedAt: string };
  const parent_id = input.parent_id ?? null;

  const trip = await createTripRemote(op.targetId, { ...input, parent_id }, editedAt);
  await upsertCachedTrip(trip);
  emit(AppEvent.tripsUpdated);
}

async function replayTripUpdate(op: QueuedOperation): Promise<void> {
  const realId = op.targetId;
  const { editedAt, ...input } = op.payload as unknown as TripInput & { editedAt: string };
  const parent_id = input.parent_id ?? null;

  const trip = await updateTripRemote(realId, { ...input, parent_id }, editedAt);
  if (trip) {
    await upsertCachedTrip(trip);
  } else {
    await reconcileSupersededTripCache(realId);
  }
  emit(AppEvent.tripsUpdated);
}

async function replayTripDelete(op: QueuedOperation): Promise<void> {
  const realId = op.targetId;
  const { deletedAt } = op.payload as { deletedAt: string };
  const deleted = await deleteTripRemote(realId, deletedAt);
  if (!deleted) {
    await reconcileSupersededTripCache(realId);
  }
  emit(AppEvent.tripsUpdated);
}

async function reconcileSupersededTripCache(id: string): Promise<void> {
  const current = await fetchTripRemoteById(id);
  if (current) {
    await upsertCachedTrip(current);
  } else {
    await removeCachedTrip(id);
  }
}

// ---- categories ----

async function replayCategoryCreate(op: QueuedOperation): Promise<void> {
  const { editedAt, ...input } = op.payload as unknown as CategoryInput & { editedAt: string };
  const category = await createCategoryRemote(op.targetId, input, editedAt);
  await upsertCachedCategory(category);
}

async function replayCategoryUpdate(op: QueuedOperation): Promise<void> {
  const realId = op.targetId;
  const { editedAt, ...input } = op.payload as unknown as CategoryInput & { editedAt: string };
  const category = await updateCategoryRemote(realId, input, editedAt);
  if (category) {
    await upsertCachedCategory(category);
  } else {
    await reconcileSupersededCategoryCache(realId);
  }
}

async function replayCategoryDelete(op: QueuedOperation): Promise<void> {
  const realId = op.targetId;
  const { deletedAt } = op.payload as { deletedAt: string };
  const deleted = await deleteCategoryRemote(realId, deletedAt);
  if (deleted) {
    await removeCachedCategoryCascade(realId);
  } else {
    await reconcileSupersededCategoryCache(realId);
  }
}

async function reconcileSupersededCategoryCache(id: string): Promise<void> {
  const current = await fetchCategoryRemoteById(id);
  if (current) {
    await upsertCachedCategory(current);
  } else {
    await removeCachedCategoryCascade(id);
  }
}
