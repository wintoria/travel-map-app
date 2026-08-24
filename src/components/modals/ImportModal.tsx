"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { AppEvent, emit } from "@/lib/events";
import { bulkUpsertPlaces, fetchPendingPlacesByTrip } from "@/lib/api/places";
import { batchGeocodePlaces } from "@/lib/geocode";

// Shape of a Google Takeout GeoJSON feature (only the fields we read).
interface ImportProps {
  Title?: string; title?: string; name?: string;
  Comment?: string; Note?: string; description?: string;
  "Google Maps URL"?: string; url?: string;
  Location?: { "Business Name"?: string; Address?: string };
}
interface ImportFeature {
  geometry?: { coordinates?: number[] };
  properties?: ImportProps;
}

export default function ImportModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");

  const [file, setFile] = useState<File | null>(null);
  const [trips, setTrips] = useState<{ id: string; name: string }[]>([]);
  const [selectedTrip, setSelectedTrip] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  // Reference to force-clear the file input element visually
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available trips for the dropdown when modal opens
  useEffect(() => {
    const fetchTrips = async () => {
      const { data } = await supabase.from("trips").select("id, name").order("name");
      if (data) {
        setTrips(data);
        if (data.length > 0) setSelectedTrip(data[0].id);
      }
    };
    if (modal === "import-google") fetchTrips();
  }, [modal]);

  // Only render if the URL parameter matches the modal name
  if (modal !== "import-google") return null;

  const closeModal = () => {
    // Force reset all states immediately so the next open is clean
    setMessage({ text: "", type: "" });
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("modal");
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedTrip) {
      setMessage({ text: "Wybierz plik i folder docelowy.", type: "error" });
      return;
    }
    if (!navigator.onLine) {
      setMessage({ text: "Import wymaga połączenia z internetem.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        let parsedData: ImportFeature[] = [];

        if (file.name.endsWith(".json")) {
          // Parse JSON file (Google GeoJSON format)
          const jsonData = JSON.parse(content);
          parsedData = Array.isArray(jsonData) ? jsonData : (jsonData.features || [jsonData]);

          // Map GeoJSON fields to our database schema
          const placesToInsert = parsedData.map(feature => {
            const lng = feature.geometry?.coordinates?.[0];
            const lat = feature.geometry?.coordinates?.[1];
            const props = feature.properties || {};

            // Smart fallback for Google's messy property names
            const placeName = props.Title || props.title || props.name || (props.Location && props.Location['Business Name']) || props.Location?.Address || "Zapisane miejsce";
            const placeNote = props.Comment || props.Note || props.description || "";
            const placeUrl = props['Google Maps URL'] || props.url || null;

            return {
              trip_id: selectedTrip,
              name: placeName,
              google_maps_url: placeUrl,
              note: placeNote,
              lat: lat,
              lng: lng,
              address: props.Location?.Address || ""
            };
          }).filter(place => place.lat && place.lng); // Ensure coordinates exist

          // Perform UPSERT to database
          const { error } = await bulkUpsertPlaces(placesToInsert, "trip_id, google_maps_url");
          if (error) throw new Error(error.message || "Błąd zapisu do bazy danych.");

          setMessage({ text: `Sukces! Zapisano ${placesToInsert.length} miejsc (JSON).`, type: "success" });
          emit(AppEvent.tripsUpdated);

          // Auto-close modal
          setTimeout(() => closeModal(), 1500);

        } else if (file.name.endsWith(".csv")) {
          // Parse CSV format from Google Takeout
          const rows = content.split('\n').filter(row => row.replace(/,/g, '').trim().length > 0);
          const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

          const parsedData = rows.slice(1).map(row => {
            // Split by comma, ignoring commas inside quotes
            const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            const obj: Record<string, string> = {};
            headers.forEach((header, i) => {
              obj[header] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : "";
            });
            return obj;
          });

          // Map CSV fields to our database schema
          const placesToInsert = parsedData.map(props => {
            const placeName = props.Title || props.title || props.Name || props.name || props.Tytuł || props.tytuł || "Zapisane miejsce";
            const placeNote = props.Comment || props.Note || props.note || props.Notatka || props.notatka || "";
            const placeUrl = props.URL || props.url || props['Google Maps URL'] || null;

            // Extract coordinates if they are hidden inside the URL
            let lat = null;
            let lng = null;

            if (placeUrl) {
              const matchAt = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
              const matchQuery = placeUrl.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (matchAt) { lat = parseFloat(matchAt[1]); lng = parseFloat(matchAt[2]); }
              else if (matchQuery) { lat = parseFloat(matchQuery[1]); lng = parseFloat(matchQuery[2]); }
            }

            return {
              trip_id: selectedTrip,
              name: placeName,
              google_maps_url: placeUrl,
              note: placeNote,
              lat: lat,
              lng: lng, // Sending null if no coordinates found
              address: ""
            };
          });

          if (placesToInsert.length === 0) {
             throw new Error("Brak danych w pliku CSV.");
          }

          // Drop rows sharing the same Google Maps URL — the upsert conflict target is
          // (trip_id, google_maps_url), and Postgres rejects a batch that hits the same
          // conflict key twice with "ON CONFLICT DO UPDATE command cannot affect row a second time".
          const seenUrls = new Set<string>();
          const uniquePlaces = placesToInsert.filter(p => {
            if (!p.google_maps_url) return true;
            if (seenUrls.has(p.google_maps_url)) return false;
            seenUrls.add(p.google_maps_url);
            return true;
          });

          // Fetch existing places in this folder that already have valid coordinates
          const { data: existingPlaces } = await supabase
            .from("places")
            .select("name, google_maps_url, lat, lng")
            .eq("trip_id", selectedTrip)
            .not("lat", "is", null);

          if (existingPlaces && existingPlaces.length > 0) {
            uniquePlaces.forEach(newPlace => {
              // Find a match based on Google Maps URL or exact Name
              const match = existingPlaces.find(ep =>
                (newPlace.google_maps_url && ep.google_maps_url === newPlace.google_maps_url) ||
                (ep.name === newPlace.name)
              );

              // If we have a match and the incoming file has no coordinates, restore them!
              if (match && newPlace.lat === null) {
                newPlace.lat = match.lat;
                newPlace.lng = match.lng;
              }
            });
          }

          // Perform UPSERT to database
          const { error } = await bulkUpsertPlaces(uniquePlaces, "trip_id, google_maps_url");
          if (error) throw new Error(error.message || "Błąd zapisu do bazy danych.");

          emit(AppEvent.tripsUpdated);

          // Calculate how many places are missing coordinates for the success message
          const missingCoordsCount = uniquePlaces.filter(p => p.lat === null).length;

          if (missingCoordsCount > 0) {
            setMessage({ text: `Zaimportowano ${uniquePlaces.length} miejsc. Szukam współrzędnych dla ${missingCoordsCount}...`, type: "success" });

            // Look up coordinates by place name for anything the import left without lat/lng
            // (Google's "Zapisane miejsca" export links carry no @lat,lng — only a CID hash).
            const toGeocode = await fetchPendingPlacesByTrip(selectedTrip);
            const { found } = await batchGeocodePlaces(toGeocode, {
              onProgress: (current, total) => {
                setMessage({ text: `Szukam współrzędnych... (${current}/${total})`, type: "success" });
              },
            });
            emit(AppEvent.tripsUpdated);

            setMessage({
              text: `Sukces! Zaimportowano ${uniquePlaces.length} miejsc. Znaleziono współrzędne dla ${found} z ${missingCoordsCount} brakujących.`,
              type: "success",
            });
          } else {
            setMessage({ text: `Sukces! Zaimportowano ${uniquePlaces.length} miejsc.`, type: "success" });
          }

          setLoading(false);
          setFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }

          // Auto-close modal
          setTimeout(() => closeModal(), 4000);

        } else {
          throw new Error("Obsługiwane są tylko pliki .json oraz .csv");
        }
      } catch (error) {
        console.error("Import error:", error);
        const msg = error instanceof Error ? error.message : "Nieprawidłowy plik.";
        setMessage({ text: `Błąd importu: ${msg}`, type: "error" });
        setLoading(false); // Stop loading only on error, so it doesn't flicker before auto-close
      }
    };

    reader.readAsText(file);
  };

  return (
    <Modal onClose={closeModal} title="Import z Google Maps" maxWidth="max-w-md" zIndex="z-[60]">
      <div className="p-6">
        {message.text && (
          <div className={`p-3 rounded-lg text-sm mb-4 font-medium border ${message.type === 'error' ? 'bg-error/15 text-error border-error/40' : 'bg-success/15 text-success border-success/40'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleImport} className="flex flex-col gap-4">

          {/* Target Folder Selection */}
          <div>
            <label className="block text-sm font-medium text-base-content/80 mb-1">Do jakiego folderu zapisać?</label>
            <select
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
              className="select select-bordered w-full bg-base-100 border-base-300 text-base-content"
              required
            >
              <option value="" disabled>Wybierz folder...</option>
              {trips.map(trip => (
                <option key={trip.id} value={trip.id}>{trip.name}</option>
              ))}
            </select>
          </div>

          <div className="p-4 border-2 border-dashed border-base-300 rounded-xl bg-base-100 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-base-content/60 file:mr-4 file:py-2 file:px-4 file:font-bold file:bg-primary/15 file:text-primary file:border-0 file:rounded-full hover:file:bg-primary/25 cursor-pointer"
            />
          </div>

          <p className="text-xs text-muted">
            Wybierz plik .json lub .csv z paczki Google Takeout (sekcja &quot;Zapisane&quot;).
          </p>

          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="ghost" onClick={closeModal} className="px-4">
              Anuluj
            </Button>
            <Button type="submit" variant="primary" disabled={!file || !selectedTrip || loading} className="px-4">
              {loading ? "Importowanie..." : "Importuj"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
