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

        const safeMatches = results.filter((match) => {
          const raw = match.raw as unknown as Record<string, unknown>;
          const isNotJustCity = raw.class !== "boundary" && raw.class !== "place";
          const hasTextMatch = nameWords.some((w) => match.label.toLowerCase().includes(w));
          return isNotJustCity && hasTextMatch;
        });

        // STRICT RULE: Only save if exactly one match
        if (safeMatches.length === 1) {
          const bestMatch = safeMatches[0];
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
