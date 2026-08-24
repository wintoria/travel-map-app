"use client";
import { useState } from "react";
import { ICON_GROUPS, autoColorForEmoji } from "@/lib/color";

// Google-Maps-style icon picker: pick an emoji from a curated grid instead of typing free text.
// The circle color is always auto-derived from the chosen emoji (autoColorForEmoji) — no separate
// color input needed, and the preview here is exactly what the map marker will look like.
export default function IconPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const color = autoColorForEmoji(value);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Wybierz ikonę"
        style={{ backgroundColor: color }}
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 border-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
      >
        {value}
      </button>

      {open && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute z-50 top-full left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl p-3 space-y-3">
            {ICON_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{group.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onChange(emoji);
                        setOpen(false);
                      }}
                      title={emoji}
                      style={{ backgroundColor: group.color }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-base cursor-pointer border-2 transition-transform hover:scale-110 ${
                        value === emoji ? "border-gray-800" : "border-transparent"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
