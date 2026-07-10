import { isStrongBeatLyricLine, stripStrongBeatLyricLines } from "./abc-beat-annotations";
import { stripAbcChordSymbols } from "./abc-duration";
import {
  normalizeAbcInlineVoiceLine,
  normalizeAbcVoiceDeclarationLine,
  normalizeAbcVoiceId,
  normalizeAbcVoiceSyntax,
} from "./abc-voice-normalization";

export const ABC_LAYER_IDS = {
  chordProgression: "ChordProgression",
  lyrics: "Lyrics",
  strongBeats: "StrongBeats",
  tab: "TAB",
} as const;

export type AbcLayerKind = "semantic" | "voice" | "render";

export interface AbcLayerVisibilityItem {
  id: string;
  label: string;
  kind: AbcLayerKind;
  defaultVisible: boolean;
  enabled: boolean;
  supportsVolume: boolean;
}

export const ABC_LAYER_VOLUME = {
  min: 0,
  max: 100,
  step: 5,
  defaultPercent: 100,
} as const;

interface ExtractAbcLayerVisibilityOptions {
  includeFallbackMelody?: boolean;
  includeStrongBeats?: boolean;
  includeTab?: boolean;
  tabEnabled?: boolean;
}

const LEGACY_VISIBILITY_KEYS: Record<string, string> = {
  __melody__: "Melody",
  __chords__: ABC_LAYER_IDS.chordProgression,
  __strong_beats__: ABC_LAYER_IDS.strongBeats,
  __guitar_tab__: ABC_LAYER_IDS.tab,
  melody: "Melody",
  harmony: ABC_LAYER_IDS.chordProgression,
};

function splitLines(abcString: string): string[] {
  return abcString.split(/\r?\n/);
}

function isHeaderOrDirectiveLine(trimmed: string): boolean {
  if (!trimmed) return true;
  if (trimmed.startsWith("%")) return true;
  if (trimmed.startsWith("%%")) return true;
  if (/^[A-Za-z]:/.test(trimmed)) return true;
  return false;
}

function parseScoreVoiceIds(line: string): string[] {
  const match = line.trim().match(/^%%score\s+(.+)$/);
  if (!match) return [];

  const cleaned = match[1]
    .replace(/[(){}\[\]]/g, " ")
    .split(/\s+/)
    .map((voice) => voice.trim())
    .filter(Boolean)
    .filter((voice) => !/^[|,&]+$/.test(voice));

  return cleaned.map(normalizeAbcVoiceId);
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeVolumePercent(value: number | undefined, defaultPercent = ABC_LAYER_VOLUME.defaultPercent): number {
  if (!Number.isFinite(value)) return defaultPercent;
  const roundedToStep = Math.round((value ?? defaultPercent) / ABC_LAYER_VOLUME.step) * ABC_LAYER_VOLUME.step;
  return Math.min(ABC_LAYER_VOLUME.max, Math.max(ABC_LAYER_VOLUME.min, roundedToStep));
}

function volumePercentToMidiValue(percent: number): number {
  return Math.round((normalizeVolumePercent(percent) / 100) * 127);
}

export function getAbcLayerVolumePercent(
  layerId: string,
  volumes: Record<string, number> = {},
  defaultPercent = ABC_LAYER_VOLUME.defaultPercent
): number {
  return normalizeVolumePercent(volumes[layerId], defaultPercent);
}

export function normalizeAbcLayerVisibility(visibility: Record<string, boolean> = {}): Record<string, boolean> {
  const normalized: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(visibility)) {
    const mappedKey = LEGACY_VISIBILITY_KEYS[key] ?? key;
    normalized[mappedKey] = value;
  }

  return normalized;
}

export function isAbcLayerVisible(
  layerId: string,
  visibility: Record<string, boolean>,
  defaultVisible = true
): boolean {
  const normalizedVisibility = normalizeAbcLayerVisibility(visibility);
  return normalizedVisibility[layerId] ?? defaultVisible;
}

export function extractAbcVoiceIds(abcString: string, includeFallbackMelody = true): string[] {
  const normalizedAbc = normalizeAbcVoiceSyntax(abcString);
  const scoreVoices: string[] = [];
  const discoveredVoices: string[] = [];

  for (const rawLine of splitLines(normalizedAbc)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (/^%%score\b/.test(trimmed)) {
      scoreVoices.push(...parseScoreVoiceIds(trimmed));
      continue;
    }

    const declaration = normalizeAbcVoiceDeclarationLine(trimmed).match(/^V:(\S+)/);
    if (declaration) {
      discoveredVoices.push(normalizeAbcVoiceId(declaration[1]));
    }

    for (const inlineVoice of trimmed.matchAll(/\[V:([^\]]+)\]/g)) {
      discoveredVoices.push(normalizeAbcVoiceId(inlineVoice[1]));
    }
  }

  const normalizedScoreVoices = uniqueValues(scoreVoices);
  const normalizedDiscoveredVoices = uniqueValues(discoveredVoices);
  const allVoices = normalizedScoreVoices.length > 0
    ? uniqueValues([...normalizedScoreVoices, ...normalizedDiscoveredVoices])
    : normalizedDiscoveredVoices;

  if (allVoices.length === 0 && includeFallbackMelody) return ["Melody"];
  return allVoices;
}

function hasStrongBeatLyricLine(abcString: string): boolean {
  return splitLines(abcString).some(isStrongBeatLyricLine);
}

export function extractAbcLayerVisibilityItems(
  abcString: string,
  options: ExtractAbcLayerVisibilityOptions = {}
): AbcLayerVisibilityItem[] {
  const {
    includeFallbackMelody = true,
    includeStrongBeats,
    includeTab = true,
    tabEnabled,
  } = options;
  const voiceIds = extractAbcVoiceIds(abcString, includeFallbackMelody);
  const hasVisibleGuitar = voiceIds.includes("Guitar");
  const shouldIncludeStrongBeats = includeStrongBeats ?? hasStrongBeatLyricLine(abcString);

  return [
    {
      id: ABC_LAYER_IDS.chordProgression,
      label: ABC_LAYER_IDS.chordProgression,
      kind: "semantic",
      defaultVisible: true,
      enabled: true,
      supportsVolume: true,
    },
    {
      id: ABC_LAYER_IDS.lyrics,
      label: ABC_LAYER_IDS.lyrics,
      kind: "semantic",
      defaultVisible: true,
      enabled: true,
      supportsVolume: false,
    },
    ...(shouldIncludeStrongBeats ? [{
      id: ABC_LAYER_IDS.strongBeats,
      label: ABC_LAYER_IDS.strongBeats,
      kind: "semantic" as const,
      defaultVisible: true,
      enabled: true,
      supportsVolume: false,
    }] : []),
    ...voiceIds.map((voiceId) => ({
      id: voiceId,
      label: voiceId,
      kind: "voice" as const,
      defaultVisible: true,
      enabled: true,
      supportsVolume: true,
    })),
    ...(includeTab ? [{
      id: ABC_LAYER_IDS.tab,
      label: ABC_LAYER_IDS.tab,
      kind: "render" as const,
      defaultVisible: false,
      enabled: tabEnabled ?? hasVisibleGuitar,
      supportsVolume: false,
    }] : []),
  ];
}

function shouldStripChordSymbols(line: string, showChordProgression: boolean): boolean {
  if (showChordProgression) return false;
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("%")) return false;
  if (/^[A-Za-z]:/.test(trimmed) && !/^V:/.test(trimmed)) return false;
  return true;
}

function normalizeScoreLineForVisibleVoices(line: string, visibleVoices: Set<string>): string | null {
  const scoreVoices = parseScoreVoiceIds(line).filter((voice) => visibleVoices.has(voice));
  if (scoreVoices.length === 0) return null;
  return `%%score ${scoreVoices.map((voice) => `(${voice})`).join(" ")}`;
}

function removeHiddenInlineVoiceSegments(line: string, visibleVoices: Set<string>): string {
  const normalizedLine = normalizeAbcInlineVoiceLine(line);
  if (!/\[V:[^\]]+\]/.test(normalizedLine)) return normalizedLine;

  const segments = normalizedLine.split(/(?=\[V:[^\]]+\])/g);
  return segments
    .map((segment) => {
      const match = segment.match(/^\[V:([^\]]+)\]\s*(.*)$/);
      if (!match) return segment;
      return visibleVoices.has(normalizeAbcVoiceId(match[1])) ? segment.trim() : "";
    })
    .filter(Boolean)
    .join(" ");
}

function voiceVolumeDirective(voiceName: string, volumes: Record<string, number>): string {
  const volume = volumePercentToMidiValue(getAbcLayerVolumePercent(voiceName, volumes));
  return `%%MIDI beat ${volume} ${volume} ${volume} 1`;
}

function chordVolumeDirectives(volumes: Record<string, number>): string[] {
  const volume = volumePercentToMidiValue(getAbcLayerVolumePercent(ABC_LAYER_IDS.chordProgression, volumes));
  return [`%%MIDI chordvol ${volume}`, `%%MIDI bassvol ${volume}`];
}

function insertAfterKeyLine(lines: string[], insertedLines: string[]): string[] {
  const keyIndex = lines.findIndex((line) => /^\s*K:/.test(line));
  if (keyIndex < 0) return [...insertedLines, ...lines];
  return [...lines.slice(0, keyIndex + 1), ...insertedLines, ...lines.slice(keyIndex + 1)];
}

export function ensureMelodyMidiProgram52(abcString: string): string {
  return applyAbcLayerVolumes(abcString, {});
}

export function applyAbcLayerVolumes(abcString: string, volumes: Record<string, number> = {}): string {
  const normalizedAbc = normalizeAbcVoiceSyntax(abcString);
  const lines = splitLines(normalizedAbc);
  const hasVoiceDeclarations = lines.some((line) => /^\s*V:/.test(line));
  const output: string[] = [];
  let currentVoice: string | null = null;
  let melodyProgramApplied = false;

  if (!hasVoiceDeclarations) {
    const directives = ["%%MIDI program 52", voiceVolumeDirective("Melody", volumes), ...chordVolumeDirectives(volumes)];
    return insertAfterKeyLine(
      lines.filter((line) => !/^\s*%%MIDI\s+(program|vol|beat|chordvol|bassvol)\b/.test(line.trim())),
      directives
    ).join("\n");
  }

  for (const rawLine of lines) {
    const normalizedDeclaration = normalizeAbcVoiceDeclarationLine(rawLine);
    const declaration = normalizedDeclaration.trim().match(/^V:(\S+)/);

    if (declaration) {
      currentVoice = normalizeAbcVoiceId(declaration[1]);
      output.push(normalizedDeclaration);
      if (currentVoice === "Melody") {
        output.push("%%MIDI program 52");
        melodyProgramApplied = true;
      }
      output.push(voiceVolumeDirective(currentVoice, volumes));
      continue;
    }

    const midiDirective = rawLine.trim().match(/^%%MIDI\s+(program|vol|beat|chordvol|bassvol)\b/);
    if (midiDirective) {
      if (midiDirective[1] === "vol" || midiDirective[1] === "beat" || midiDirective[1] === "chordvol" || midiDirective[1] === "bassvol") continue;
      if (midiDirective[1] === "program" && currentVoice === "Melody") continue;
    }

    output.push(rawLine);
  }

  const withChordVolumes = insertAfterKeyLine(output, chordVolumeDirectives(volumes));
  if (melodyProgramApplied || !extractAbcVoiceIds(abcString, false).includes("Melody")) return withChordVolumes.join("\n");
  return insertAfterKeyLine(withChordVolumes, ["V:Melody name=\"Melody\" stem=up", "%%MIDI program 52", voiceVolumeDirective("Melody", volumes)]).join("\n");
}

export function applyAbcLayerVisibility(abcString: string, visibility: Record<string, boolean>): string {
  const normalizedVisibility = normalizeAbcLayerVisibility(visibility);
  const showChordProgression = isAbcLayerVisible(ABC_LAYER_IDS.chordProgression, normalizedVisibility, true);
  const showLyrics = isAbcLayerVisible(ABC_LAYER_IDS.lyrics, normalizedVisibility, true);
  const showStrongBeats = isAbcLayerVisible(ABC_LAYER_IDS.strongBeats, normalizedVisibility, true);

  const lines = abcString.split(/\r?\n/);
  const hasLyrics = showLyrics && lines.some(line => /^\s*[wW\+]:/.test(line));
  const hasChords = showChordProgression && lines.some(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%") || (/^[A-Za-z]:/.test(trimmed) && !/^V:/.test(trimmed))) return false;
    return /"[^"]+"/.test(trimmed);
  });

  const melodyVisible = isAbcLayerVisible("Melody", normalizedVisibility, true) || hasLyrics || hasChords;
  const allVoices = extractAbcVoiceIds(abcString, true);
  const visibleVoices = new Set(
    allVoices.filter((voice) => {
      if (voice === "Melody") return melodyVisible;
      return isAbcLayerVisible(voice, normalizedVisibility, true);
    })
  );
  const normalizedAbc = normalizeAbcVoiceSyntax(abcString);
  const output: string[] = [];
  let currentVoice: string | null = null;
  let currentVoiceVisible = true;
  let lastKeptLineWasMusic = false;

  for (const rawLine of splitLines(normalizedAbc)) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      output.push(rawLine);
      lastKeptLineWasMusic = false;
      continue;
    }

    if (/^%%score\b/.test(trimmed)) {
      const scoreLine = normalizeScoreLineForVisibleVoices(trimmed, visibleVoices);
      if (scoreLine) output.push(scoreLine);
      lastKeptLineWasMusic = false;
      continue;
    }

    if (isStrongBeatLyricLine(trimmed)) {
      if (showStrongBeats && lastKeptLineWasMusic) output.push(rawLine);
      continue;
    }

    if (/^w:/.test(trimmed) || /^W:/.test(trimmed) || /^\+:/.test(trimmed)) {
      if (showLyrics && lastKeptLineWasMusic) output.push(rawLine);
      continue;
    }

    const normalizedDeclaration = normalizeAbcVoiceDeclarationLine(rawLine);
    const declaration = normalizedDeclaration.trim().match(/^V:(\S+)/);
    if (declaration) {
      currentVoice = normalizeAbcVoiceId(declaration[1]);
      currentVoiceVisible = visibleVoices.has(currentVoice);
      if (currentVoiceVisible) output.push(normalizedDeclaration);
      lastKeptLineWasMusic = false;
      continue;
    }

    if (/\[V:[^\]]+\]/.test(trimmed)) {
      const filteredLine = removeHiddenInlineVoiceSegments(rawLine, visibleVoices);
      if (filteredLine.trim()) {
        output.push(shouldStripChordSymbols(filteredLine, showChordProgression) ? stripAbcChordSymbols(filteredLine) : filteredLine);
        lastKeptLineWasMusic = true;
      } else {
        lastKeptLineWasMusic = false;
      }
      continue;
    }

    if (currentVoice && !currentVoiceVisible) {
      lastKeptLineWasMusic = false;
      continue;
    }

    if (!currentVoice && !visibleVoices.has("Melody") && !isHeaderOrDirectiveLine(trimmed)) {
      lastKeptLineWasMusic = false;
      continue;
    }

    output.push(shouldStripChordSymbols(rawLine, showChordProgression) ? stripAbcChordSymbols(rawLine) : rawLine);
    lastKeptLineWasMusic = !isHeaderOrDirectiveLine(trimmed);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function getVisibleAbcVoiceIds(abcString: string, visibility: Record<string, boolean>): string[] {
  const normalizedVisibility = normalizeAbcLayerVisibility(visibility);
  return extractAbcVoiceIds(abcString, true).filter((voice) => isAbcLayerVisible(voice, normalizedVisibility, true));
}

export function cleanAbcForExport(abcString: string): string {
  if (!abcString) return "";
  // 1. Remove string-forcing decorations like !1!, !2!, ..., !6!
  //    These are ABCJS-specific tablature hints that other viewers show as fingering numbers.
  let cleaned = abcString.replace(/![1-6]!/g, "");

  // 2. Remove strong beat lyric lines (w: ⬤ * • * ...)
  cleaned = stripStrongBeatLyricLines(cleaned);

  // 3. Normalize clef=treble-8 → clef=treble for universal viewer portability.
  //    clef=treble-8 is standard ABC 2.1 for guitar (sounds octave lower than written)
  //    but some ABC viewers don't support it. Removing the "-8" keeps the staff notation
  //    visually identical — only the small "8" below the clef disappears. MIDI playback
  //    in other software will sound one octave higher, but the sheet music is correct.
  cleaned = cleaned.replace(/clef=treble-8/g, "clef=treble");

  return cleaned;
}
