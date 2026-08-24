import { OpenStreetMapProvider } from "leaflet-geosearch";
import { updatePlaceCoords } from "@/lib/api/places";
import { AppEvent, emit } from "@/lib/events";

export interface GeocodeTarget {
  id: string;
  name: string;
}

interface BatchGeocodeOptions {
  onProgress?: (current: number, total: number) => void;
  onResult?: (place: GeocodeTarget, found: boolean) => void;
}

interface GeoPoint {
  x: number; // lng
  y: number; // lat
}

// Distance in meters between two lat/lng points (haversine).
function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.y - a.y) * Math.PI) / 180;
  const dLng = ((b.x - a.x) * Math.PI) / 180;
  const lat1 = (a.y * Math.PI) / 180;
  const lat2 = (b.y * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Groups results that sit within ~300m of each other — OSM often returns several
// nodes/ways for one real-world spot (a POI plus a duplicate node), which would
// otherwise fail the "exactly one match" rule below.
function clusterByProximity<T extends GeoPoint>(matches: T[]): T[][] {
  const clusters: T[][] = [];
  for (const match of matches) {
    const cluster = clusters.find((c) => distanceMeters(c[0], match) < 300);
    if (cluster) cluster.push(match);
    else clusters.push([match]);
  }
  return clusters;
}

// City/administrative results are often duplicated in Nominatim as both a place
// node and a boundary relation for the very same municipality — their centroids
// can legitimately sit a few km apart, so proximity clustering misses them.
// An identical display label is a reliable signal they're the same place.
function clusterByLabel<T extends { label: string }>(matches: T[]): T[][] {
  const clusters: T[][] = [];
  for (const match of matches) {
    const cluster = clusters.find((c) => c[0].label === match.label);
    if (cluster) cluster.push(match);
    else clusters.push([match]);
  }
  return clusters;
}

// Throttled (~1.5s/request) lookup against Nominatim, saving only on a single
// confident match. Shared between the sidebar's manual "uzupełnij" action and
// the auto-geocode that runs right after a CSV/JSON import.
export async function batchGeocodePlaces(
  places: GeocodeTarget[],
  options?: BatchGeocodeOptions
): Promise<{ found: number; total: number }> {
  const provider = new OpenStreetMapProvider();
  let found = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    options?.onProgress?.(i + 1, places.length);
    let matched = false;

    try {
      const cleanQuery = place.name.replace(/[^\w\sĀ-ɏ]/gi, "").trim();
      const results = await provider.search({ query: cleanQuery });

      if (results && results.length > 0) {
        const nameWords = cleanQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const textMatches = results.filter((match) => nameWords.some((w) => match.label.toLowerCase().includes(w)));

        // Prefer a specific (non-administrative) match, e.g. a landmark over the city
        // it sits in. Only fall back to city/boundary hits for entries that are
        // themselves just a place name (no more specific match exists at all).
        const specificMatches = textMatches.filter((match) => {
          const raw = match.raw as unknown as Record<string, unknown>;
          return raw.class !== "boundary" && raw.class !== "place";
        });
        const candidates = specificMatches.length > 0 ? specificMatches : textMatches;
        const isCityLevel = specificMatches.length === 0;

        // STRICT RULE: only save if every remaining candidate collapses into the
        // same real-world spot (handles OSM returning duplicate nodes for one place).
        const clusters = isCityLevel ? clusterByLabel(candidates) : clusterByProximity(candidates);
        if (clusters.length === 1) {
          const bestMatch = clusters[0][0];
          const { error } = await updatePlaceCoords(place.id, bestMatch.y, bestMatch.x);
          if (!error) {
            matched = true;
            found++;
            emit(AppEvent.placesUpdated);
          }
        }
      }
    } catch (err) {
      console.error(`Geocoding error for ${place.name}`, err);
    }

    options?.onResult?.(place, matched);

    if (i < places.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return { found, total: places.length };
}
