import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Place, Trip, Category, PlaceCategory } from "@/lib/types";
import type { QueuedOperation, PendingFile } from "./types";

interface TravelMapDB extends DBSchema {
  places: { key: string; value: Place };
  trips: { key: string; value: Trip };
  categories: { key: string; value: Category };
  placeCategories: {
    key: string; // `${place_id}:${category_id}`
    value: PlaceCategory & { key: string };
    indexes: { "by-place": string; "by-category": string };
  };
  mutationQueue: { key: number; value: QueuedOperation };
  pendingFiles: { key: string; value: PendingFile };
}

let dbPromise: Promise<IDBPDatabase<TravelMapDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TravelMapDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TravelMapDB>("travel-map-offline", 1, {
      upgrade(db) {
        db.createObjectStore("places", { keyPath: "id" });
        db.createObjectStore("trips", { keyPath: "id" });
        db.createObjectStore("categories", { keyPath: "id" });

        const placeCategories = db.createObjectStore("placeCategories", { keyPath: "key" });
        placeCategories.createIndex("by-place", "place_id");
        placeCategories.createIndex("by-category", "category_id");

        db.createObjectStore("mutationQueue", { keyPath: "seq", autoIncrement: true });
        db.createObjectStore("pendingFiles", { keyPath: "fileRef" });
        // Note: no idMap store — ids are generated client-side and are stable from creation, so no
        // temp-id -> real-id remapping is ever needed (previously here, removed).
      },
    });
  }
  return dbPromise;
}

export function placeCategoryKey(placeId: string, categoryId: string): string {
  return `${placeId}:${categoryId}`;
}

export type { TravelMapDB };
