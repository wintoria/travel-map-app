import GlobalSearch from "./GlobalSearch";

export default function Topbar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-[45] flex items-center justify-end px-4">
      {/* Centered logo using absolute positioning */}
      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-green-600 hidden sm:block">
        TravelMap
      </div>
      
      {/* Search bar pushed to the right */}
      <div className="w-full max-w-xs sm:max-w-sm flex justify-end">
        <GlobalSearch />
      </div>
    </header>
  );
}