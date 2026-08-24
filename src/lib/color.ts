// Tag color helpers. Consolidated from previously duplicated copies in
// ManageTagsModal, ViewPlaceModal and TagSelector.

const NAMED_COLORS: Record<string, string> = {
  white: "ffffff", black: "000000", red: "ff0000", green: "008000",
  blue: "0000ff", yellow: "ffff00", orange: "ffa500", purple: "800080",
  gray: "808080", brown: "a52a2a", cyan: "00ffff", lime: "00ff00",
};

// Perceived brightness (0-255) of a hex or legacy named color. Returns 255 (→ dark text) on parse failure.
export function getBrightness(color: string): number {
  if (!color) return 255;
  let str = color.trim().toLowerCase();
  str = NAMED_COLORS[str] || str.replace(/[^0-9a-f]/g, "");
  if (str.length === 3) str = str.split("").map((c) => c + c).join("");
  if (str.length !== 6) return 255;
  const r = parseInt(str.substring(0, 2), 16);
  const g = parseInt(str.substring(2, 4), 16);
  const b = parseInt(str.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Black or white text color for readable contrast on the given background.
// `threshold` defaults to 180 (used by ViewPlaceModal); ManageTagsModal historically used 140.
export function getContrastColor(hexColor: string, threshold = 180): "#000000" | "#ffffff" {
  if (!hexColor) return "#000000";
  return getBrightness(hexColor) > threshold ? "#000000" : "#ffffff";
}

// Normalize a tag color for display: treat pure white / "white" as light gray so it stays visible.
export function effectiveTagColor(rawColor: string | null | undefined): string {
  const color = rawColor || "#ffffff";
  const isWhite = color.toLowerCase().includes("ffffff") || color.trim().toLowerCase() === "white";
  return isWhite ? "#e5e7eb" : color;
}

// Google-Maps-style category colors for map marker circles. Curated by emoji so a marker's color
// always matches what the emoji represents (food = orange, nature = green, ...) without the user
// having to pick one.
const MARKER_PALETTE = {
  red: "#EA4335",
  orange: "#FA7B17",
  amber: "#F9AB00",
  green: "#34A853",
  teal: "#12B5CB",
  blue: "#4285F4",
  indigo: "#7B61FF",
  purple: "#A142F4",
  pink: "#F439A0",
  brown: "#8D6E63",
} as const;

export interface IconGroup {
  label: string;
  color: string;
  emojis: string[];
}

// Curated icon choices for the tag icon picker, grouped for browsability. Each group's color is
// what autoColorForEmoji() returns for its emoji — the picker preview and the map marker always match.
export const ICON_GROUPS: IconGroup[] = [
  { label: "Ogólne", color: MARKER_PALETTE.red, emojis: ["📍", "⭐", "🚩", "🎯", "🧭", "🏷️"] },
  { label: "Jedzenie i picie", color: MARKER_PALETTE.orange, emojis: ["🍔", "🍕", "🍜", "🍣", "🍱", "🍝", "🍛", "🍤", "🥘", "🍲", "🥗", "🍰", "🧁", "🍩", "🍪", "☕", "🍵", "🍷", "🍸", "🍺", "🍻", "🥂", "🍽️", "🍴", "🥐", "🌮", "🌯", "🥙", "🍦", "🍨", "🥖", "🍞", "🧋", "🍹"] },
  { label: "Natura", color: MARKER_PALETTE.green, emojis: ["🌳", "🌲", "🌴", "🏞️", "🌄", "🌅", "⛰️", "🏔️", "🌵", "🌻", "🌼", "🍃", "🦋", "🐦", "🏕️", "🌱", "🌾"] },
  { label: "Plaża i woda", color: MARKER_PALETTE.teal, emojis: ["🏖️", "🏝️", "🌊", "⛱️", "🐚", "🚤", "🛥️", "🏄", "🤿", "⛵"] },
  { label: "Kultura i historia", color: MARKER_PALETTE.brown, emojis: ["🏛️", "🎭", "🖼️", "📚", "🗿", "⛩️", "🕌", "🕍", "⛪", "🏯", "🏰", "🗼"] },
  { label: "Zakupy", color: MARKER_PALETTE.pink, emojis: ["🛍️", "🛒", "🏬", "👗", "👠", "💄", "🎁", "💍"] },
  { label: "Nocleg", color: MARKER_PALETTE.purple, emojis: ["🏨", "🏩", "🛏️", "🏠", "🏡", "🏚️", "🔑"] },
  { label: "Transport", color: MARKER_PALETTE.blue, emojis: ["✈️", "🚆", "🚄", "🚌", "🚗", "🚕", "🚢", "⛴️", "🚀", "🚁", "⛽", "🚏", "🚉", "🛳️", "🚦", "🚲", "🛴"] },
  { label: "Rozrywka", color: MARKER_PALETTE.indigo, emojis: ["🎡", "🎢", "🎪", "🎬", "🎮", "🎉", "🎊", "🎳", "🎤", "🎧", "🕹️", "🎨", "🎵", "🎶"] },
  { label: "Sport", color: MARKER_PALETTE.amber, emojis: ["⚽", "🏀", "🎾", "🏈", "⚾", "🏐", "🏓", "🏸", "🥊", "🏊", "🚴", "⛷️", "🏂", "🧗", "🏋️"] },
  { label: "Zdrowie", color: MARKER_PALETTE.red, emojis: ["🏥", "💊", "🚑", "➕", "❤️"] },
];

const EMOJI_COLOR_MAP: Record<string, string> = Object.fromEntries(
  ICON_GROUPS.flatMap((group) => group.emojis.map((e) => [e, group.color]))
);

const PALETTE_VALUES = Object.values(MARKER_PALETTE);

// Deterministic fallback for emoji outside the curated list, so uncurated icons still get a
// consistent, non-gray color instead of all looking the same.
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return PALETTE_VALUES[Math.abs(hash) % PALETTE_VALUES.length];
}

export function autoColorForEmoji(emoji: string | null | undefined): string {
  if (!emoji) return MARKER_PALETTE.red;
  return EMOJI_COLOR_MAP[emoji] ?? hashColor(emoji);
}

// Landmark glyph used for map markers that have no main tag and no trip icon — classic Google-pin red.
export const DEFAULT_MARKER_EMOJI = "📍";
