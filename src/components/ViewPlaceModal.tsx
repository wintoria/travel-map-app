"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ViewPlaceModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get URL parameters
  const modalType = searchParams.get("modal");
  const placeId = searchParams.get("placeId");

  const [place, setPlace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    // Only fetch if this specific modal is active
    if (modalType !== "view-place" || !placeId) return;

    const fetchPlaceDetails = async () => {
      setIsLoading(true);
      
      // Fetch single place data from Supabase
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("id", placeId)
        .single();

      if (error) {
        console.error("Error fetching place details:", error);
      } else {
        setPlace(data);
      }
      
      setIsLoading(false);
    };

    fetchPlaceDetails();
  }, [modalType, placeId]);

  // Close modal by clearing URL parameters
  const handleClose = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("modal");
    params.delete("placeId");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Delete place and notify map
  const handleDeleteConfirm = async () => {
    setIsLoading(true);
    const { error } = await supabase.from("places").delete().eq("id", place.id);

    if (!error) {
      window.dispatchEvent(new Event("places-updated")); // Refresh map markers
      
      // Close modal quietly
      const params = new URLSearchParams(window.location.search);
      params.delete("modal");
      params.delete("placeId");
      router.push(`?${params.toString()}`, { scroll: false });
    } else {
      console.error("Delete error:", error);
      setIsLoading(false);
    }
  };

  // Do not render if the modal type does not match
  if (modalType !== "view-place") return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Title and Close button */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Szczegóły miejsca</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <p className="text-center text-gray-500">Ładowanie danych...</p>
          ) : place ? (
            <div className="space-y-4">
              
              {/* Title, Address and Visited Badge */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-bold text-gray-900">{place.name}</h3>
                  {/* Visited status badge */}
                  {place.visited ? (
                    <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shrink-0">
                      Odwiedzone
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider shrink-0">
                      Nieodwiedzone
                    </span>
                  )}
                </div>
                {place.address && <p className="text-sm text-gray-500 mt-1">{place.address}</p>}
              </div>

              {/* Coordinates */}
              <div className="flex gap-4 text-xs text-gray-400 border-b border-gray-50 pb-3">
                <span>Lat: {place.lat}</span>
                <span>Lng: {place.lng}</span>
              </div>

              {/* Duration */}
              {place.duration && (
                <div className="text-sm text-gray-700">
                  <span className="font-semibold">Szacowany czas:</span> {place.duration}
                </div>
              )}

              {/* Note */}
              {place.note && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{place.note}</p>
                </div>
              )}

              {/* External Links & Attachments */}
              {(place.google_maps_url || place.additional_link || place.attached_file) && (
                <div className="flex flex-col gap-2 pt-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Linki i załączniki</p>
                  
                  {/* Google Maps link */}
                  {place.google_maps_url && (
                    <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2">
                      📍 Otwórz w Google Maps
                    </a>
                  )}
                  
                  {/* Website link */}
                  {place.additional_link && (
                    <a href={place.additional_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2">
                      🌐 Strona internetowa
                    </a>
                  )}
                  
                  {/* Uploaded File link */}
                  {place.attached_file && (
                    <a href={place.attached_file} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-2">
                      📎 Otwórz załącznik
                    </a>
                  )}
                </div>
              )}

              {/* Action Buttons (Edit / Delete / Confirm) */}
              <div className="pt-4 mt-2 border-t border-gray-100">
                {showDeleteConfirm ? (
                  <div className="bg-red-50 p-3 rounded-lg flex flex-col items-center animate-in fade-in zoom-in duration-200">
                    <p className="text-sm text-red-800 font-medium mb-3">Czy na pewno chcesz usunąć to miejsce?</p>
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)} 
                        className="flex-1 bg-white border border-red-200 text-gray-700 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50"
                      >
                        Anuluj
                      </button>
                      <button 
                        onClick={handleDeleteConfirm} 
                        className="flex-1 bg-red-600 text-white py-1.5 rounded-md text-sm font-bold hover:bg-red-700"
                      >
                        Tak, usuń
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition-colors text-sm cursor-pointer">
                      Edytuj
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(true)} 
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2.5 rounded-lg transition-colors text-sm cursor-pointer"
                    >
                      Usuń
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-red-500">Nie znaleziono miejsca.</p>
          )}
        </div>
      </div>
    </div>
  );
}