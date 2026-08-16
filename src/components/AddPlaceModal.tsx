import Link from "next/link";

export default function AddPlaceModal({ currentView }: { currentView: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl relative">
        
        {/* Close button (returns to map/list view without modal param) */}
        <Link 
          href={`?view=${currentView}`}
          scroll={false}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl"
        >
          ✕
        </Link>

        <h2 className="text-xl font-bold text-gray-800 mb-4">Dodaj nowe miejsce</h2>
        
        {/* Empty state placeholder */}
        <div className="h-40 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
          <p className="text-gray-500 text-sm text-center px-4">
            Zaraz zbudujemy tu pole wyszukiwania, koordynaty i opcję notatki.
          </p>
        </div>

      </div>
    </div>
  );
}