"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Palette } from "lucide-react";
import { MARKER_PALETTE } from "@/lib/color";

const PRESETS = Object.values(MARKER_PALETTE);
const PANEL_WIDTH = 200;

// Small circular swatch button that opens a popover to override a tag's background color —
// sits as a badge on the corner of IconPicker's trigger. `color` is the currently effective
// color (auto-derived-from-emoji or a previously saved override); `onChange(null)` resets back
// to the automatic emoji-derived color. Renders in a portal so it's never clipped by a modal's
// scrollable body, same as IconPicker.
export default function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = rect.left;
    const top = rect.bottom + 8;
    if (left + PANEL_WIDTH > window.innerWidth - 8) left = window.innerWidth - PANEL_WIDTH - 8;
    if (left < 8) left = 8;
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative shrink-0 -ml-3 mt-6">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Zmień kolor tła"
        style={{ backgroundColor: color }}
        className="w-5 h-5 rounded-full border-2 border-base-200 shadow flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
      >
        <Palette size={10} className="text-white drop-shadow" />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              className="fixed z-[9999] bg-base-200 border border-base-300 rounded-lg shadow-xl p-3 space-y-3"
              style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      onChange(preset);
                      setOpen(false);
                    }}
                    style={{ backgroundColor: preset }}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                      color === preset ? "border-base-content" : "border-base-300"
                    }`}
                  />
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-base-300 bg-transparent p-0"
                />
                Własny kolor
              </label>

              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-xs text-muted hover:text-base-content underline cursor-pointer"
              >
                Przywróć domyślny (z ikony)
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
