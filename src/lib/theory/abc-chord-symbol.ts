export function normalizeAbcChordSymbol(symbol: string): string {
  return symbol.trim().replace(/\s+/g, "").replace(/♯/g, "#").replace(/♭/g, "b");
}

export function isAbcChordSymbol(symbol: string): boolean {
  const normalized = normalizeAbcChordSymbol(symbol);
  if (!normalized || /^[\^_<>@]/.test(normalized)) return false;
  if (/^(rit\.?|accel\.?|fine|dc|d\.c\.|ds|d\.s\.|coda|segno)$/i.test(normalized)) return false;
  return /^[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add|no|\+|°|ø|\d|\(|\)|\/|-)*$/i.test(normalized) || /^N\.?C\.?$/i.test(normalized);
}
