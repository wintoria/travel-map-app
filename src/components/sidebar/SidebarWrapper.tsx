"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

export default function SidebarWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger toggle button positioned visually inside the top header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed top-3 left-3 sm:left-4 z-[50] bg-base-200 px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm font-bold text-base-content border border-base-300 hover:bg-base-300 cursor-pointer flex items-center gap-2 text-sm transition-colors"
      >
        <Menu size={20} /> <span className="hidden sm:inline">Zakładki</span>
      </button>

      {/* The sidebar panel (bounded by the relative main container in page.tsx) */}
      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}