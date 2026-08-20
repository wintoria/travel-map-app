"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";

export default function SidebarWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger toggle button positioned visually inside the top header */}
      <button 
        onClick={() => setIsOpen((prev) => !prev)} 
        className="fixed top-3 left-4 z-[50] bg-white px-3 py-1.5 rounded-lg shadow-sm font-bold text-gray-800 border border-gray-200 hover:bg-gray-50 cursor-pointer flex items-center gap-2 text-sm transition-colors"
      >
        <span className="text-lg leading-none">☰</span> Zakładki
      </button>

      {/* The sidebar panel (bounded by the relative main container in page.tsx) */}
      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}