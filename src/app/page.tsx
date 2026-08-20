import { supabase } from "@/lib/supabase";
import Map from "@/components/Map";
import PlaceList from "@/components/PlaceList";
import Link from "next/link";
import AddPlaceModal from "@/components/AddPlaceModal";
import ViewPlaceModal from "@/components/ViewPlaceModal";
import EditPlaceModal from "@/components/EditPlaceModal";
import SidebarWrapper from "@/components/SidebarWrapper";
import AddTripModal from "@/components/AddTripModal";
import EditTripModal from "@/components/EditTripModal";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; modal?: string; trips?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "map";
  const showModal = params.modal === "add-place";
  
  return (
    <main className="flex-1 flex flex-col p-4 relative">
      {view === "map" ? <Map /> : <PlaceList />}

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

      <ViewPlaceModal />

      <EditPlaceModal currentView={view} />

      {/* Sidebar wrapper handles button and state internally */}
      <SidebarWrapper />

      <AddTripModal />

      <EditTripModal />
    </main>
  );
}