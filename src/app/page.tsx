import { supabase } from "@/lib/supabase";
import Map from "@/components/Map";
import PlaceList from "@/components/PlaceList";
import Link from "next/link";
import AddPlaceModal from "@/components/AddPlaceModal";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; modal?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "map";
  
  // Check if "?modal=add-place" is in the URL
  const showModal = params.modal === "add-place";

  const { data: places } = await supabase.from("places").select("*");

  return (
    <main className="flex-1 flex flex-col p-4 relative">
      {view === "map" ? <Map places={places || []} /> : <PlaceList />}

      {/* Floating "Add" button */}
      <Link
        href={`?view=${view}&modal=add-place`}
        scroll={false}
        className="fixed bottom-26 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl pb-1 z-40 hover:bg-blue-700 transition-colors"
      >
        +
      </Link>

      {/* Form modal (renders only when showModal is true) */}
      {showModal && <AddPlaceModal currentView={view} />}
    </main>
  );
}