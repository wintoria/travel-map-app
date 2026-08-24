import type { Trip } from "./types";

// Accepts either the full Trip row or any of the lighter id/name/icon/parent_id projections used
// for dropdowns, so both fetchTrips() and fetchTripsBasic() results work here.
type TripLike = Pick<Trip, "id" | "parent_id">;

// Recursively collect all descendant trip ids of a parent (used for cascading filter toggles).
export function getAllDescendants(parentId: string, allTrips: TripLike[]): string[] {
  const children = allTrips.filter((t) => t.parent_id === parentId);
  let ids = children.map((c) => c.id);
  children.forEach((c) => {
    ids = [...ids, ...getAllDescendants(c.id, allTrips)];
  });
  return ids;
}

// Direct children of a parent (null = top level), preserving input order.
export function childrenOf<T extends TripLike>(trips: T[], parentId: string | null = null): T[] {
  return trips.filter((t) => (t.parent_id || null) === (parentId || null));
}
