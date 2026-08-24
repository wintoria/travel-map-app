"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { AppEvent, emit } from "@/lib/events";
import { currentParams, pushParams } from "@/lib/url";

export default function GlobalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);

  // Debounce logic: wait 300ms before pushing to URL
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = currentParams();

      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }

      pushParams(router, params);

      // Notify map and list immediately without waiting for Next.js router
      emit(AppEvent.searchChanged, { query: query.trim() });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, router]);

  return (
    <div className="relative flex-1 min-w-0 max-w-sm mx-2 sm:mx-4">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted">
        <Search size={16} />
      </span>
      <input
        type="text"
        placeholder="Szukaj miejsc..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-1.5 bg-base-100 border border-base-300 text-base-content rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary transition-shadow"
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-base-content cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}