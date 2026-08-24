"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
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

// Client component reading searchParams via the hook (not the server `searchParams` prop) so that
// switching view/modal is a pure client-side re-render — no Next.js RSC round-trip. That round-trip
// is exactly what broke opening a place while offline: it would fail and fall back to a full page
// load, landing on the offline fallback instead of the app with the cached place data.
function HomeContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "map";
  const showAddModal = searchParams.get("modal") === "add-place";
  const showManageTags = searchParams.get("modal") === "manage-tags";

  return (
    <main className="flex-1 flex flex-col p-4 relative overflow-hidden">
      {view === "map" ? <Map /> : <PlaceList />}

      {/* Floating "Add" button */}
      <Link
        href={`?view=${view}&modal=add-place`}
        scroll={false}
        className="fixed bottom-26 right-6 w-14 h-14 bg-primary text-primary-content rounded-full shadow-lg flex items-center justify-center text-3xl pb-1 z-40 hover:bg-primary/90 transition-colors"
      >
        +
      </Link>

      {/* Form modal (renders only when showAddModal is true) */}
      {showAddModal && <AddPlaceModal currentView={view} />}

      <ViewPlaceModal />

      <EditPlaceModal />

      {/* Sidebar wrapper handles button and state internally */}
      <SidebarWrapper />

      <AddTripModal />

      <EditTripModal />

      {/* Render ManageTagsModal when URL param matches */}
      {showManageTags && <ManageTagsModal />}

      <ShareTripModal />

      <ImportModal />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
