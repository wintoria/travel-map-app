// Local IndexedDB mirror of Supabase data — write-through cache used as a read fallback when offline.
import { getDB, placeCategoryKey } from "./db";
import { getAllDescendants } from "@/lib/tree";
import type { Place, Trip, Category, PlaceCategory } from "@/lib/types";

// ---- places ----

export async function cachePlaces(places: Place[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("places", "readwrite");
  await Promise.all(places.map((p) => tx.store.put(p)));
  await tx.done;
}

export async function getCachedPlaces(): Promise<Place[]> {
  const db = await getDB();
  return db.getAll("places");
}

export async function upsertCachedPlace(place: Place): Promise<void> {
  const db = await getDB();
  await db.put("places", place);
}

export async function removeCachedPlace(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("places", id);
}

// ---- trips ----

export async function cacheTrips(trips: Trip[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("trips", "readwrite");
  await Promise.all(trips.map((t) => tx.store.put(t)));
  await tx.done;
}

export async function getCachedTrips(): Promise<Trip[]> {
  const db = await getDB();
  return db.getAll("trips");
}

export async function upsertCachedTrip(trip: Trip): Promise<void> {
  const db = await getDB();
  await db.put("trips", trip);
}

export async function removeCachedTrip(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("trips", id);
}

// Removes a trip, all its descendant trips, and every place attached to any of them.
export async function removeCachedTripCascade(tripId: string, allTrips: Trip[]): Promise<void> {
  const descendantIds = getAllDescendants(tripId, allTrips);
  const idsToRemove = [tripId, ...descendantIds];

  const db = await getDB();
  const places = await db.getAll("places");
  const placesToRemove = places.filter((p) => p.trip_id && idsToRemove.includes(p.trip_id));

  await Promise.all([
    ...idsToRemove.map((id) => removeCachedTrip(id)),
    ...placesToRemove.map((p) => removeCachedPlace(p.id)),
    ...placesToRemove.map((p) => removeCachedPlaceCategoriesForPlace(p.id)),
  ]);
}

// ---- categories ----

export async function cacheCategories(categories: Category[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("categories", "readwrite");
  await Promise.all(categories.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function getCachedCategories(): Promise<Category[]> {
  const db = await getDB();
  return db.getAll("categories");
}

export async function upsertCachedCategory(category: Category): Promise<void> {
  const db = await getDB();
  await db.put("categories", category);
}

export async function removeCachedCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("categories", id);
}

export async function removeCachedCategoryCascade(categoryId: string): Promise<void> {
  const db = await getDB();
  const relations = await db.getAllFromIndex("placeCategories", "by-category", categoryId);
  await Promise.all([
    removeCachedCategory(categoryId),
    ...relations.map((r) => db.delete("placeCategories", placeCategoryKey(r.place_id, r.category_id))),
  ]);
}

// ---- place_categories ----

export async function cachePlaceCategories(relations: PlaceCategory[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("placeCategories", "readwrite");
  await Promise.all(
    relations.map((r) => tx.store.put({ ...r, key: placeCategoryKey(r.place_id, r.category_id) }))
  );
  await tx.done;
}

export async function getCachedPlaceCategories(): Promise<PlaceCategory[]> {
  const db = await getDB();
  return db.getAll("placeCategories");
}

export async function removeCachedPlaceCategoriesForPlace(placeId: string): Promise<void> {
  const db = await getDB();
  const relations = await db.getAllFromIndex("placeCategories", "by-place", placeId);
  await Promise.all(relations.map((r) => db.delete("placeCategories", placeCategoryKey(r.place_id, r.category_id))));
}

export async function setCachedPlaceCategoriesForPlace(placeId: string, categoryIds: string[]): Promise<void> {
  await removeCachedPlaceCategoriesForPlace(placeId);
  await cachePlaceCategories(categoryIds.map((category_id) => ({ place_id: placeId, category_id })));
}
