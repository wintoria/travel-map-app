import Map from "@/components/map/Map";
import PlaceList from "@/components/list/PlaceList";
import Link from "next/link";
import AddPlaceModal from "@/components/modals/AddPlaceModal";
import ViewPlaceModal from "@/components/modals/ViewPlaceModal";
import EditPlaceModal from "@/components/modals/EditPlaceModal";
import SidebarWrapper from "@/components/sidebar/SidebarWrapper";
import AddTripModal from "@/components/modals/AddTripModal";
import EditTripModal from "@/components/modals/EditTripModal";
import ManageTagsModal from "@/components/tags/ManageTagsModal";
import ShareTripModal from "@/components/modals/ShareTripModal";
import ImportModal from "@/components/modals/ImportModal";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; modal?: string; trips?: string }>;
}) {
  const params = await searchParams;
  const view = params.view || "map";
  const showModal = params.modal === "add-place";
  
  return (
    <main className="flex-1 flex flex-col p-4 relative overflow-hidden">
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

      <EditPlaceModal />

      {/* Sidebar wrapper handles button and state internally */}
      <SidebarWrapper />

      <AddTripModal />

      <EditTripModal />

      {/* Render ManageTagsModal when URL param matches */}
      {params.modal === "manage-tags" && <ManageTagsModal />}

      <ShareTripModal />

      <ImportModal />
    </main>
  );
}