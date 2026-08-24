"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { openModal } from "@/lib/url";
import { Smartphone, Download, LogOut } from "lucide-react";

// The non-standard PWA install prompt event (not yet in TS DOM lib).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  // State to hold the PWA install event
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
      setDeferredPrompt(e as BeforeInstallPromptEvent);
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
        className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center font-bold text-lg hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
        title={email}
      >
        {email ? email.charAt(0).toUpperCase() : "U"}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-base-200 rounded-xl shadow-lg border border-base-300 overflow-hidden z-50">
          <div className="px-4 py-3 bg-base-300 border-b border-base-300">
            <p className="text-xs font-medium text-base-content/70 uppercase">Zalogowano jako</p>
            <p className="text-sm font-bold text-base-content truncate mt-0.5">{email}</p>
          </div>

          <div className="p-2 flex flex-col gap-1">
            {/* PWA Install Button (visible only when ready) */}
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10 rounded-md transition-colors text-left cursor-pointer"
              >
                <Smartphone size={16} /> Zainstaluj aplikację
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                openModal(router, "import-google");
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-base-content hover:bg-base-300 rounded-md transition-colors text-left cursor-pointer"
            >
              <Download size={16} /> Importuj z Google
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-error hover:bg-error/10 rounded-md transition-colors text-left cursor-pointer"
            >
              <LogOut size={16} /> Wyloguj się
            </button>
          </div>
        </div>
      )}
    </div>
  );
}