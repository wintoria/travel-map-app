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
