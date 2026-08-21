"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

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
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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