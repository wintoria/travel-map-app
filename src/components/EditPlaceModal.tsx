"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TagSelector from "./TagSelector";
import { OpenStreetMapProvider } from "leaflet-geosearch";

export default function EditPlaceModal({ currentView }: { currentView: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const modalType = searchParams.get("modal");
  const placeId = searchParams.get("placeId");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingCoords, setIsSearchingCoords] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [place, setPlace] = useState<any>(null);
  const [initialCategories, setInitialCategories] = useState<string[]>([]);

  // Refs to directly manipulate the form inputs without re-rendering everything
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  // Store all available trips for the dropdown hierarchy
  const [trips, setTrips] = useState<any[]>([]);

  // Fetch existing data to populate the form
  useEffect(() => {
    if (modalType !== "edit-place" || !placeId) return;

    const fetchData = async () => {
      // Force the loading screen to show every time the modal opens
      setIsLoading(true); 

      // Fetch place and its category relations in a single, optimized query
      const { data: placeData, error: placeError } = await supabase
        .from("places")
        .select(`
          *,
          place_categories ( category_id )
        `)
        .eq("id", placeId)
        .single();

      if (!placeError && placeData) {
        setPlace(placeData);
        if (placeData.place_categories) {
          setInitialCategories(placeData.place_categories.map((pc: any) => pc.category_id));
        }
      }

      const { data: tripsData } = await supabase
        .from("trips")
        .select("id, name, parent_id, icon")
        .order("created_at", { ascending: true });
        
      if (tripsData) setTrips(tripsData);

      // Hide loading screen only after new data is ready
      setIsLoading(false);
    };
    fetchData();

  }, [modalType, placeId]);

  // Close completely to map view by clearing modal parameters
  const handleCloseToMap = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("modal");
    params.delete("placeId");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Go back to the view details modal
  const handleBackToDetails = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("modal", "view-place"); // Keep the same placeId, just change modal type
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      const name = formData.get("name") as string;
      const trip_id = formData.get("trip_id") as string;
      const lat = parseFloat(formData.get("lat") as string);
      const lng = parseFloat(formData.get("lng") as string);
      const address = formData.get("address") as string;
      const duration = formData.get("duration") as string;
      const note = formData.get("note") as string;
      let googleMapsUrl = formData.get("googleMapsUrl") as string;
      const additionalInfo = formData.get("additionalInfoUrl") as string;
      // Extract category IDs from the hidden input before updating
      const categoryIds = JSON.parse((formData.get("category_ids") as string) || "[]");

      if (!googleMapsUrl && !isNaN(lat) && !isNaN(lng)) {
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      }

      // Handle file upload if a new file is provided
      const file = formData.get("additionalInfoFile") as File;
      let attachedFileUrl = place.attached_file; // Keep old file by default

      if (file && file.size > 0) {
        const fileExt = file.name.substring(file.name.lastIndexOf('.'));
        const safeBaseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${safeBaseName}-${Math.random().toString(36).substring(2, 7)}${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from("attachments").upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(fileName);
        attachedFileUrl = publicUrl;
      }

      // Update the DB record for the place
      const { error: dbError } = await supabase.from("places").update({
        name, trip_id, lat, lng, address, duration, note,
        google_maps_url: googleMapsUrl,
        additional_link: additionalInfo, 
        attached_file: attachedFileUrl
      }).eq("id", placeId);

      if (dbError) throw dbError;

      // Update category relationships (clear old, insert new)
      await supabase.from("place_categories").delete().eq("place_id", placeId);
      
      if (categoryIds.length > 0) {
        const relations = categoryIds.map((categoryId: string) => ({
          place_id: placeId,
          category_id: categoryId
        }));
        await supabase.from("place_categories").insert(relations);
      }

      // Force Next.js to purge client cache before navigating back
      router.refresh();

      // Return to details modal and refresh map in the background
      handleBackToDetails();
      setTimeout(() => window.dispatchEvent(new Event("places-updated")), 300);

    } catch (error) {
      console.error("Update error:", error);
      alert("Wystąpił błąd podczas aktualizacji.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to interactively find coordinates based on name and address inputs
  const handleAutoSearch = async () => {
    const name = nameRef.current?.value || "";
    const address = addressRef.current?.value || "";

    // Build query from both fields for better context
    const query = `${name} ${address}`.trim();
    if (!query) {
      setSearchError("Wpisz nazwę lub adres, aby wyszukać.");
      setSearchResults([]);
      return;
    }

    setIsSearchingCoords(true);
    setSearchError(null);
    setSearchResults([]);
    
    try {
      const provider = new OpenStreetMapProvider();
      // We don't strip special characters here so standard address formats work better
      const results = await provider.search({ query });

      if (results && results.length > 0) {
        setSearchResults(results);
      } else {
        setSearchError("Nie znaleziono wyników. Spróbuj dopisać lub zmienić miasto w polu adresu.");
      }
    } catch (error) {
      console.error("Geosearch error:", error);
      setSearchError("Błąd połączenia z mapą. Spróbuj ponownie.");
    } finally {
      setIsSearchingCoords(false);
    }
  };

  // Function to handle the user selecting a specific result from the list
  const handleSelectResult = (result: any) => {
    if (latRef.current) latRef.current.value = result.y.toString();
    if (lngRef.current) lngRef.current.value = result.x.toString();
    
    // Clear search UI after successful selection
    setSearchResults([]);
    setSearchError(null);
  };

  if (modalType !== "edit-place") return null;

  const renderOptions = (parentId: string | null = null, level: number = 0) => {
    const children = trips.filter((t) => (t.parent_id || null) === (parentId || null));
    return children.map((child) => (
      <React.Fragment key={child.id}>
        <option value={child.id} className={level === 0 ? "font-bold" : ""}>
          {"\u00A0\u00A0\u00A0".repeat(level)}
          {level > 0 ? "└ " : ""}
          {child.icon ? `${child.icon} ` : ""}{child.name}
        </option>
        {renderOptions(child.id, level + 1)}
      </React.Fragment>
    ));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full max-w-xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Single clean header */}
        <div className="p-6 border-b border-gray-100 relative flex-shrink-0">
          <button onClick={handleCloseToMap} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 font-bold text-xl cursor-pointer">
            ✕
          </button>
          <h2 className="text-xl font-bold text-gray-800">Edytuj miejsce</h2>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <p className="text-center p-6 text-gray-500">Ładowanie danych...</p>
          ) : (
            <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4 flex flex-col p-6 pt-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa miejsca *</label>
                <input ref={nameRef} type="text" name="name" required defaultValue={place?.name} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zakładka *</label>
                <select 
                  name="trip_id" 
                  required 
                  defaultValue={place?.trip_id}
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white"
                >
                  <option value="">-- Wybierz zakładkę --</option>
                  {renderOptions(null, 0)}
                </select>
              </div>

              {/* Coordinates Section with Smart Geosearch Button */}
              <div className="flex flex-col gap-1 pt-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Współrzędne (Lat / Lng) *</label>
                  <button
                    type="button"
                    onClick={handleAutoSearch}
                    disabled={isSearchingCoords}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1.5 px-3 rounded flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    title="Pobierz z OpenStreetMap na podstawie nazwy i adresu"
                  >
                    {isSearchingCoords ? "⏳ Szukam..." : "📍 Znajdź na mapie"}
                  </button>
                </div>
                
                {/* Inline Error UI (replaces system alerts) */}
                {searchError && (
                  <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded-lg border border-red-200 mb-1 flex justify-between items-center animate-in fade-in">
                    <span>{searchError}</span>
                    <button type="button" onClick={() => setSearchError(null)} className="text-red-500 hover:text-red-800 cursor-pointer text-lg leading-none ml-2">✕</button>
                  </div>
                )}

                {/* Interactive Search Results List */}
                {searchResults.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-md max-h-48 overflow-y-auto mb-2 z-10 flex flex-col animate-in fade-in zoom-in duration-150">
                    <div className="bg-gray-50 p-2 text-xs font-bold text-gray-500 border-b border-gray-200 flex justify-between items-center sticky top-0">
                      <span>Wybierz właściwe miejsce ({searchResults.length}):</span>
                      <button type="button" onClick={() => setSearchResults([])} className="text-gray-400 hover:text-gray-700 cursor-pointer text-lg leading-none">✕</button>
                    </div>
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectResult(result)}
                        className="text-left p-2.5 text-xs text-gray-700 hover:bg-amber-50 border-b border-gray-100 last:border-0 cursor-pointer transition-colors"
                      >
                        {result.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1">
                    <input ref={latRef} type="text" name="lat" required defaultValue={place?.lat || ""} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" placeholder="np. 52.229" />
                  </div>
                  <div className="flex-1">
                    <input ref={lngRef} type="text" name="lng" required defaultValue={place?.lng || ""} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" placeholder="np. 21.012" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                <input ref={addressRef} type="text" name="address" defaultValue={place?.address} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" placeholder="Opcjonalnie (pomaga w wyszukiwaniu)" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Szacowany czas</label>
                <input type="text" name="duration" defaultValue={place?.duration} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notatka</label>
                <textarea name="note" rows={3} defaultValue={place?.note} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tagi / Kategorie</label>
                <TagSelector initialSelected={initialCategories} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps URL</label>
                <input type="url" name="googleMapsUrl" defaultValue={place?.google_maps_url} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strona WWW</label>
                <input type="url" name="additionalInfoUrl" defaultValue={place?.additional_link} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 mb-4" />
                
                <label className="block text-sm font-medium text-gray-700 mb-1">Załącznik</label>
                
                {/* Show current attachment link with decoded filename */}
                {place?.attached_file && (
                  <div className="mb-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 flex items-center gap-2">
                    <span className="font-medium">Aktualny:</span>
                    <a href={place.attached_file} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate" title="Otwórz plik">
                      {decodeURIComponent(place.attached_file.split('/').pop() || "Otwórz podgląd")}
                    </a>
                  </div>
                )}
                
                <input type="file" name="additionalInfoFile" accept=".pdf,image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 cursor-pointer mt-1" />
                <p className="text-xs text-gray-400 mt-1">Wybierz nowy plik, aby nadpisać stary.</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4 pt-2">
                <button 
                  type="button" 
                  onClick={handleBackToDetails}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="flex-[2] bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 cursor-pointer"
                >
                  {isSubmitting ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}