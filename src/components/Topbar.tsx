export default function Topbar() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow-md z-50 flex items-center justify-between px-4">
      <div className="font-bold text-xl text-green-600">TravelMap</div>
      
      {/* TODO: Replace with dynamic Trip Switcher */}
      <button className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-medium transition-colors">
        Wybierz wyjazd ▼
      </button>
    </header>
  );
}