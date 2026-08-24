// Pure, in-memory re-implementation of fetchFilteredPlaces' filtering semantics (src/lib/api/places.ts),
// used as the offline fallback when the live Supabase query can't run. Keep the two in sync by hand —
// this mirrors intent (substring search, trip-name/tag-name -> id resolution), not the SQL itself.
import type { Place, Trip, Category, PlaceCategory } from "@/lib/types";
import type { PlaceFilters } from "@/lib/api/places";

export function applyPlaceFilters(
  places: Place[],
  filters: PlaceFilters,
  trips: Pick<Trip, "id" | "name">[],
  categories: Pick<Category, "id" | "name">[],
  placeCategories: PlaceCategory[]
): Place[] {
  const { trips: tripNamesParam, tags: tagNamesParam, query: searchParam, isEmpty } = filters;

  if (isEmpty) return [];

  let result = places.filter((p) => p.lat !== null && p.lng !== null);

  if (searchParam) {
    const q = searchParam.toLowerCase();
    result = result.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q) ||
        (p.note ?? "").toLowerCase().includes(q)
    );
  }

  if (tripNamesParam && tripNamesParam !== "none") {
    const tripNames = tripNamesParam.split(",");
    const tripIds = trips.filter((t) => tripNames.includes(t.name)).map((t) => t.id);
    if (tripIds.length === 0) return [];
    result = result.filter((p) => p.trip_id && tripIds.includes(p.trip_id));
  }

  if (tagNamesParam) {
    const tagNames = tagNamesParam.split(",");
    const tagIds = categories.filter((c) => tagNames.includes(c.name)).map((c) => c.id);
    if (tagIds.length > 0) {
      const placeIds = placeCategories
        .filter((pc) => tagIds.includes(pc.category_id))
        .map((pc) => pc.place_id);
      if (placeIds.length === 0) return [];
      result = result.filter((p) => placeIds.includes(p.id));
    }
  }

  return result.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
