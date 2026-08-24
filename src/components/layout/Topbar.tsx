import GlobalSearch from "@/components/search/GlobalSearch";
import SyncStatusIndicator from "./SyncStatusIndicator";
import UserMenu from "./UserMenu";

export default function Topbar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-base-200 shadow-sm z-[45] flex items-center justify-end pl-14 pr-3 sm:px-4">
      {/* Centered logo using absolute positioning */}
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-primary hidden sm:block">
        TravelMap
      </div>

      {/* Search bar pushed to the right */}
      <div className="w-full min-w-0 max-w-xs sm:max-w-sm flex items-center justify-end">
        <SyncStatusIndicator />
        <GlobalSearch />
        <UserMenu />
      </div>
    </header>
  );
}