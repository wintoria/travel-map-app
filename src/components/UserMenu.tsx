"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  // State to hold the PWA install event
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Fetch logged-in user data
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
      }
    });

    // Close menu when clicking anywhere outside of it
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Capture the PWA install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Trigger the native install prompt
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null); // Hide button after successful install
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
        title={email}
      >
        {email ? email.charAt(0).toUpperCase() : "U"}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase">Zalogowano jako</p>
            <p className="text-sm font-bold text-gray-800 truncate mt-0.5">{email}</p>
          </div>
          
          <div className="p-2 flex flex-col gap-1">
            {/* PWA Install Button (visible only when ready) */}
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-md transition-colors text-left cursor-pointer"
              >
                <span>📱</span> Zainstaluj aplikację
              </button>
            )}
            <button 
              onClick={() => {
                setIsOpen(false);
                const params = new URLSearchParams(searchParams.toString());
                params.set("modal", "import-google");
                router.push(`?${params.toString()}`, { scroll: false });
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left cursor-pointer"
            >
              <span>⬇️</span> Importuj z Google
            </button>
            
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-md transition-colors text-left cursor-pointer"
            >
              <span>🚪</span> Wyloguj się
            </button>
          </div>
        </div>
      )}
    </div>
  );
}