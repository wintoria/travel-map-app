"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AppEvent, emit } from "@/lib/events";

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
          const { error } = await supabase.from("places").upsert(placesToInsert, { onConflict: "trip_id, google_maps_url", ignoreDuplicates: false });
          if (error) throw error;
          
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

          // Fetch existing places in this folder that already have valid coordinates
          const { data: existingPlaces } = await supabase
            .from("places")
            .select("name, google_maps_url, lat, lng")
            .eq("trip_id", selectedTrip)
            .not("lat", "is", null);

          if (existingPlaces && existingPlaces.length > 0) {
            placesToInsert.forEach(newPlace => {
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
          const { error } = await supabase.from("places").upsert(placesToInsert, { onConflict: "trip_id, google_maps_url", ignoreDuplicates: false });
          if (error) throw error;
          
          // Calculate how many places are missing coordinates for the success message
          const missingCoordsCount = placesToInsert.filter(p => p.lat === null).length;
          const successMessage = missingCoordsCount > 0 
            ? `Sukces! Zaimportowano ${placesToInsert.length} miejsc. (${missingCoordsCount} do uzupełnienia)` 
            : `Sukces! Zaimportowano ${placesToInsert.length} miejsc.`;
          
          setMessage({ text: successMessage, type: "success" });
          emit(AppEvent.tripsUpdated);

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Import z Google Maps</h2>
          <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
        </div>

        {message.text && (
          <div className={`p-3 rounded-lg text-sm mb-4 font-medium border ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleImport} className="flex flex-col gap-4">
          
          {/* Target Folder Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Do jakiego folderu zapisać?</label>
            <select 
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="" disabled>Wybierz folder...</option>
              {trips.map(trip => (
                <option key={trip.id} value={trip.id}>{trip.name}</option>
              ))}
            </select>
          </div>

          <div className="p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-center">
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".json,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>
          
          <p className="text-xs text-gray-500">
            Wybierz plik .json lub .csv z paczki Google Takeout (sekcja &quot;Zapisane&quot;).
          </p>

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              Anuluj
            </button>
            <button type="submit" disabled={!file || !selectedTrip || loading} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-400 cursor-pointer">
              {loading ? "Importowanie..." : "Importuj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}