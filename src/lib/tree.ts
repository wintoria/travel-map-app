import type { Trip } from "./types";

// Recursively collect all descendant trip ids of a parent (used for cascading filter toggles).
export function getAllDescendants(parentId: string, allTrips: Trip[]): string[] {
  const children = allTrips.filter((t) => t.parent_id === parentId);
  let ids = children.map((c) => c.id);
  children.forEach((c) => {
    ids = [...ids, ...getAllDescendants(c.id, allTrips)];
  });
  return ids;
}

// Direct children of a parent (null = top level), preserving input order.
export function childrenOf(trips: Trip[], parentId: string | null = null): Trip[] {
  return trips.filter((t) => (t.parent_id || null) === (parentId || null));
}
