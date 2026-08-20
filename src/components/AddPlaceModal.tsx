"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import React from "react";

export default function AddPlaceModal({ currentView }: { currentView: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [trips, setTrips] = useState<any[]>([]);

  // Fetch available trips for the dropdown
  useEffect(() => {
    supabase.from("trips").select("id, name, icon, parent_id").then(({ data }) => {
      if (data) setTrips(data);
    });
  }, []);

  // Separate root folders from child folders for hierarchy display
  const rootTrips = trips.filter((t) => !t.parent_id);
  const getChildren = (parentId: string) => trips.filter((t) => t.parent_id === parentId);

  // Extract data passed from the map search or click
  const defaultName = searchParams.get("name") || "";
  const defaultAddress = searchParams.get("address") || "";
  const defaultLat = searchParams.get("lat") || "";
  const defaultLng = searchParams.get("lng") || "";
  
  const isFromMap = !!defaultLat && !!defaultLng;
  const isNameLocked = searchParams.get("lockedName") === "true"; // Check if name should be locked

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent default page reload
    setIsSubmitting(true);

    try {
      // 1. Gather all data from the form
      const formData = new FormData(e.currentTarget);
      
      const name = formData.get("name") as string;
      const lat = parseFloat(formData.get("lat") as string);
      const lng = parseFloat(formData.get("lng") as string);
      const address = formData.get("address") as string;
      const duration = formData.get("duration") as string;
      const note = formData.get("note") as string;
      const visited = formData.get("visited") === "on";
      let googleMapsUrl = formData.get("googleMapsUrl") as string;

      // Auto-generate Google Maps URL if it was left empty
      if (!googleMapsUrl && !isNaN(lat) && !isNaN(lng)) {
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      }

      // Get the additional custom link
      const additionalInfo = formData.get("additionalInfoUrl") as string;
      
      // 2. Handle file upload (if a file was selected)
      const file = formData.get("additionalInfoFile") as File;
      let attachedFileUrl = null;

      if (file && file.size > 0) {
        const originalName = file.name;
        const lastDotIndex = originalName.lastIndexOf('.');
        
        let baseName = originalName;
        let fileExt = '';
        
        // Extract base name and extension
        if (lastDotIndex !== -1) {
          baseName = originalName.substring(0, lastDotIndex);
          fileExt = '.' + originalName.substring(lastDotIndex + 1);
        }
        
        // Clean the file name from special characters and spaces
        const safeBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Generate a 5-character random string to prevent overwriting
        const randomStr = Math.random().toString(36).substring(2, 7);
        
        // Construct the final unique file name
        const fileName = `${safeBaseName}-${randomStr}${fileExt}`;
        
        // Upload the file to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Retrieve the public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from("attachments")
          .getPublicUrl(fileName);
        
        attachedFileUrl = publicUrl;
      }

      // Read trip_id from the new dropdown
      const trip_id = formData.get("trip_id") as string;

      // 3. Insert the new place into the database
      const { error: dbError } = await supabase.from("places").insert({
        trip_id, // Uses dynamic user selection
        name,
        lat,
        lng,
        address,
        duration,
        note,
        google_maps_url: googleMapsUrl,
        visited,
        additional_link: additionalInfo, 
        attached_file: attachedFileUrl
      });

      if (dbError) throw dbError;

      // Close the modal immediately so it feels fast
      router.push(`?view=${currentView}`, { scroll: false });
      router.refresh();

      // Delay the refresh signal slightly so database and cache can sync
      setTimeout(() => {
        window.dispatchEvent(new Event("places-updated"));
      }, 300);

    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save the place. Check the console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full max-w-xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="p-6 border-b border-gray-100 relative flex-shrink-0">
          <Link 
            href={`?view=${currentView}`}
            scroll={false}
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 font-bold text-xl"
          >
            ✕
          </Link>
          <h2 className="text-xl font-bold text-gray-800">Dodaj nowe miejsce</h2>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {/* Form with browser autocomplete disabled */}
          <form autoComplete="off" onSubmit={handleSubmit} className="space-y-4 flex flex-col p-6 pt-4">
            
            {/* Place Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa miejsca *</label>
              <input 
                type="text" 
                name="name"
                required
                defaultValue={defaultName}
                readOnly={isNameLocked}
                autoComplete="off"
                className={`w-full border border-gray-300 rounded-lg p-2 outline-none ${isNameLocked ? 'bg-gray-100 text-gray-500' : 'text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
                placeholder="np. Bakkerij Wolf"
              />
            </div>

            {/* Trip / Folder Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zakładka *</label>
              <select 
                name="trip_id" 
                required 
                className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white"
              >
                <option value="">-- Wybierz zakładkę --</option>
                {rootTrips.map(root => (
                  <React.Fragment key={root.id}>
                    {/* Render parent folder */}
                    <option value={root.id} className="font-bold">
                      {root.icon ? `${root.icon} ` : ""}{root.name}
                    </option>
                    
                    {/* Render child folders with indentation */}
                    {getChildren(root.id).map(child => (
                      <option key={child.id} value={child.id}>
                        {"\u00A0\u00A0\u00A0"}└─ {child.icon ? `${child.icon} ` : ""}{child.name}
                      </option>
                    ))}
                  </React.Fragment>
                ))}
              </select>
            </div>

            {/* Coordinates (Lat & Lng) Inputs */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Szerokość (Lat) *</label>
                <input 
                  type="text" 
                  name="lat"
                  required
                  defaultValue={defaultLat}
                  readOnly={isFromMap}
                  autoComplete="off"
                  className={`w-full border border-gray-300 rounded-lg p-2 outline-none ${isFromMap ? 'bg-gray-100 text-gray-500' : 'text-gray-800 focus:ring-2 focus:ring-blue-500'}`} 
                  placeholder="np. 53.428" 
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Długość (Lng) *</label>
                <input 
                  type="text" 
                  name="lng"
                  required
                  defaultValue={defaultLng}
                  readOnly={isFromMap}
                  autoComplete="off"
                  className={`w-full border border-gray-300 rounded-lg p-2 outline-none ${isFromMap ? 'bg-gray-100 text-gray-500' : 'text-gray-800 focus:ring-2 focus:ring-blue-500'}`} 
                  placeholder="np. 14.552" 
                />
              </div>
            </div>

            {/* Address Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
              <input 
                type="text" 
                name="address"
                defaultValue={defaultAddress}
                readOnly={isFromMap}
                autoComplete="off"
                className={`w-full border border-gray-300 rounded-lg p-2 outline-none ${isFromMap ? 'bg-gray-100 text-gray-500' : 'text-gray-800 focus:ring-2 focus:ring-blue-500'}`}
                placeholder="Wpisz adres"
              />
            </div>

            {/* Estimated Duration Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Szacowany czas</label>
              <input 
                type="text" 
                name="duration"
                autoComplete="off"
                className="w-full border border-gray-300 rounded-lg p-2 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="np. 2-3h, 30 min"
              />
            </div>

            {/* Note Textarea */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notatka</label>
              <textarea 
                name="note"
                rows={3}
                autoComplete="off"
                className="w-full border border-gray-300 rounded-lg p-2 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Co warto wiedzieć o tym miejscu?"
              />
            </div>

            {/* Google Maps URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps</label>
              <input 
                type="url" 
                name="googleMapsUrl"
                autoComplete="off"
                className="w-full border border-gray-300 rounded-lg p-2 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="np. gotowy link z aplikacji"
              />
            </div>

            {/* Additional Info (URL & File Upload) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dodatkowe informacje (Strona WWW i/lub Załącznik)
              </label>
              <div className="flex flex-col gap-3">
                <input 
                  type="url" 
                  name="additionalInfoUrl"
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-lg p-2 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Wklej link (np. rezerwacja, oficjalna strona)"
                />
                <input 
                  type="file"
                  name="additionalInfoFile"
                  accept=".pdf,image/*"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />
              </div>
            </div>

            {/* Visited Status Checkbox */}
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                name="visited"
                id="visited"
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="visited" className="text-sm font-medium text-gray-700 cursor-pointer">
                Oznacz jako odwiedzone
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-4 hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {isSubmitting ? "Zapisywanie..." : "Zapisz miejsce"}
            </button>
            
          </form>
        </div>
      </div>
    </div>
  );
}