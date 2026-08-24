"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { autoColorForEmoji, mutedBg } from "@/lib/color";
import emojiData from "unicode-emoji-json/data-by-emoji.json";
import orderedEmoji from "unicode-emoji-json/data-ordered-emoji.json";

interface EmojiMeta {
  name: string;
  group: string;
}

interface EmojiEntry {
  emoji: string;
  name: string;
  group: string;
}

const GROUP_LABELS: Record<string, string> = {
  "Smileys & Emotion": "Emocje",
  "People & Body": "Ludzie",
  "Animals & Nature": "Zwierzęta i natura",
  "Food & Drink": "Jedzenie i picie",
  "Travel & Places": "Podróże i miejsca",
  Activities: "Aktywności",
  Objects: "Przedmioty",
  Symbols: "Symbole",
  Flags: "Flagi",
};

const EMOJI_META = emojiData as Record<string, EmojiMeta>;

const ALL_EMOJI: EmojiEntry[] = (orderedEmoji as string[]).map((emoji) => ({
  emoji,
  name: EMOJI_META[emoji]?.name ?? "",
  group: EMOJI_META[emoji]?.group ?? "Symbols",
}));

const GROUPED_EMOJI: { label: string; items: EmojiEntry[] }[] = (() => {
  const byGroup = new Map<string, EmojiEntry[]>();
  for (const entry of ALL_EMOJI) {
    if (!byGroup.has(entry.group)) byGroup.set(entry.group, []);
    byGroup.get(entry.group)!.push(entry);
  }
  return Array.from(byGroup.entries()).map(([group, items]) => ({
    label: GROUP_LABELS[group] ?? group,
    items,
  }));
})();

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 400;

// Google-Maps-style icon picker: pick an emoji from a searchable ~1900-emoji grid instead of typing
// free text. The trigger's circle color defaults to the emoji-derived one (autoColorForEmoji) but
// reflects an optional custom `color` override (from the adjacent ColorPicker badge) when given, so
// the preview always matches what the map marker will actually look like. The dropdown itself renders
// in a portal to document.body so it always sits above modals and never gets clipped by a scrollable
// modal body.
export default function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (emoji: string) => void;
  color?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const swatchColor = mutedBg(color || autoColorForEmoji(value));

  const updatePosition = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + PANEL_WIDTH > window.innerWidth - 8) left = window.innerWidth - PANEL_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + PANEL_HEIGHT > window.innerHeight - 8) top = rect.top - PANEL_HEIGHT - 8;
    if (top < 8) top = 8;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_EMOJI.filter((e) => e.name.includes(q));
  }, [query]);

  const closeAll = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Wybierz ikonę"
        style={{ backgroundColor: swatchColor }}
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 border-base-300 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
      >
        {value}
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            {/* Click-outside catcher — stops propagation so it only closes the picker, not a parent modal */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.stopPropagation();
                closeAll();
              }}
            />
            <div
              className="fixed z-[9999] bg-base-200 border border-base-300 rounded-lg shadow-xl flex flex-col overflow-hidden"
              style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH, height: PANEL_HEIGHT }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative shrink-0 p-2 border-b border-base-300">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-muted">
                  <Search size={14} />
                </span>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj ikony..."
                  className="w-full pl-8 pr-7 py-1.5 bg-base-100 border border-base-300 text-base-content rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted hover:text-base-content cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="overflow-y-auto p-3 space-y-3">
                {filtered ? (
                  filtered.length === 0 ? (
                    <p className="text-sm text-muted text-center py-6">Brak wyników</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {filtered.map((entry) => (
                        <button
                          key={entry.emoji}
                          type="button"
                          onClick={() => {
                            onChange(entry.emoji);
                            closeAll();
                          }}
                          title={entry.name}
                          style={{ backgroundColor: mutedBg(autoColorForEmoji(entry.emoji)) }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-base cursor-pointer border-2 transition-transform hover:scale-110 ${
                            value === entry.emoji ? "border-base-content" : "border-base-300"
                          }`}
                        >
                          {entry.emoji}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  GROUPED_EMOJI.map((group) => (
                    <div key={group.label}>
                      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((entry) => (
                          <button
                            key={entry.emoji}
                            type="button"
                            onClick={() => {
                              onChange(entry.emoji);
                              closeAll();
                            }}
                            title={entry.name}
                            style={{ backgroundColor: mutedBg(autoColorForEmoji(entry.emoji)) }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-base cursor-pointer border-2 transition-transform hover:scale-110 ${
                              value === entry.emoji ? "border-base-content" : "border-base-300"
                            }`}
                          >
                            {entry.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
