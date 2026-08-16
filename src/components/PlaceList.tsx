import { supabase } from "@/lib/supabase";

export default async function PlaceList() {
  // Fetch places from the database
  const { data: places, error } = await supabase
    .from("places")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching places:", error);
    return <div>Błąd pobierania danych.</div>;
  }

  return (
    <div className="flex-1 bg-gray-100 rounded-lg p-4 shadow-inner overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Lista miejsc</h2>
      
      <div className="space-y-3">
        {/* Render list of places */}
        {places?.map((place) => (
          <div key={place.id} className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
            <h3 className="font-bold text-blue-600">{place.name}</h3>
            <p className="text-sm text-gray-600">{place.address}</p>
            {place.note && (
              <p className="text-sm mt-2 text-gray-700 italic">"{place.note}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}