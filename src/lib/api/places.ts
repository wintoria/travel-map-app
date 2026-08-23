import { supabase } from "@/lib/supabase";
import type { Place } from "@/lib/types";

export interface PlaceFilters {
  trips?: string | null; // comma-separated trip NAMES, or "none"
  tags?: string | null; // comma-separated category NAMES
  query?: string | null; // free-text search
  isEmpty?: boolean; // true = nothing selected, return no places
}

// Shared place-filtering query used by both the map markers and the list view.
// Fetches only places with coordinates, then narrows by text search, trip and tag filters.
// Returns [] when the selection is explicitly empty or no rows match a filter stage.
export async function fetchFilteredPlaces(filters: PlaceFilters): Promise<Place[]> {
  const { trips, tags, query: searchParam, isEmpty } = filters;

  if (isEmpty) return [];

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
    const { data: tripsData } = await supabase.from("trips").select("id, name");
    if (tripsData) {
      const tripIds = tripsData.filter((t) => tripNames.includes(t.name)).map((t) => t.id);
      if (tripIds.length === 0) return [];
      query = query.in("trip_id", tripIds);
    }
  }

  // Tag filter: resolve names -> ids -> place ids via place_categories.
  if (tags) {
    const tagNames = tags.split(",");
    const { data: catData } = await supabase.from("categories").select("id, name");
    if (catData) {
      const tagIds = catData.filter((c) => tagNames.includes(c.name)).map((c) => c.id);
      if (tagIds.length > 0) {
        const { data: pcData } = await supabase
          .from("place_categories")
          .select("place_id")
          .in("category_id", tagIds);
        if (pcData && pcData.length > 0) {
          query = query.in("id", pcData.map((pc) => pc.place_id));
        } else {
          return [];
        }
      }
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("Fetch places error:", error);
    return [];
  }
  return (data as Place[]) || [];
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

// Places missing coordinates ("pending" list in the sidebar).
export async function fetchPendingPlaces(): Promise<Pick<Place, "id" | "name" | "note">[]> {
  const { data } = await supabase
    .from("places")
    .select("id, name, note")
    .is("lat", null)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function deletePlace(id: string) {
  return supabase.from("places").delete().eq("id", id);
}

export async function updatePlaceCoords(id: string, lat: number, lng: number) {
  return supabase.from("places").update({ lat, lng }).eq("id", id);
}
