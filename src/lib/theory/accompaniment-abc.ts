import {
  buildAbcDurationContext,
  extractMusicBodyLines,
  formatAbcDuration,
  measureDurationUnits,
  normalizeAbcMeasureDuration,
  splitAbcMeasureSegments,
  stripAbcChordSymbols,
  cleanAbcMeasureSegment,
} from "./abc-duration";
import { parseNoteDuration } from "./melody-analyzer";
import {
  buildStrongBeatLyricLines,
  isStrongBeatLyricLine,
  stripBeatAnnotations,
  stripStrongBeatLyricLines,
} from "./abc-beat-annotations";

/**
 * Extract chord symbols with their onset positions (in duration units) from
 * an ABC measure segment. This lets us later insert each chord at the correct
 * beat position inside an instrument measure, not all at the start.
 */
function extractChordsWithOnsets(abcMeasure: string): Array<{ chord: string; onsetUnits: number }> {
  const clean = cleanAbcMeasureSegment(abcMeasure);
  const chords: Array<{ chord: string; onsetUnits: number }> = [];
  let currentOnset = 0;

  const regex = /"([^"]+)"|((?:\[[^\]|:]+\])|(?:[_^=]*[A-Ga-g][,']*)(?:[0-9]*(?:\/[0-9]*)?|\/[0-9]*))|([zx](?:[0-9]*(?:\/[0-9]*)?|\/[0-9]*))/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clean)) !== null) {
    if (match[1]) {
      // Chord symbol — skip beat annotations like "_⬤"
      if (!match[1].startsWith("_")) {
        chords.push({ chord: match[1], onsetUnits: currentOnset });
      }
    } else if (match[2] || match[3]) {
      // Note or rest — advance onset by its duration
      const token = match[2] || match[3];
      const durSuffix = token.replace(/^(?:\[[^\]]+\]|[_^=]*[A-Ga-g][,']*|[zx])/, "");
      currentOnset += parseNoteDuration(durSuffix);
    }
  }

  return chords;
}

/**
 * Insert chord symbols at the matching beat positions within a Guitar measure.
 * Distributes chords correctly so "Em" and "D" go at their right beat positions
 * instead of being dumped at the start as "Em""D".
 */
function insertChordsIntoMeasure(
  instrumentMeasure: string,
  chordOnsets: Array<{ chord: string; onsetUnits: number }>
): string {
  if (chordOnsets.length === 0) return instrumentMeasure;

  // Strip existing chord symbols from the instrument measure to avoid duplicates
  const cleanMeasure = stripAbcChordSymbols(instrumentMeasure);

  // Parse instrument tokens with their onset positions
  const tokenRegex = /(\[[^\]|:]+\](?:[0-9]*(?:\/[0-9]*)?|\/[0-9]*)?)|([_^=]*[A-Ga-g][,']*(?:[0-9]*(?:\/[0-9]*)?|\/[0-9]*))|([zx](?:[0-9]*(?:\/[0-9]*)?|\/[0-9]*))|(![\d]!)|(\s+)/g;
  const tokens: Array<{ text: string; onset: number; isNote: boolean }> = [];
  let onset = 0;
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRegex.exec(cleanMeasure)) !== null) {
    const text = tokenMatch[0];
    const isNote = Boolean(tokenMatch[1] || tokenMatch[2] || tokenMatch[3]);
    tokens.push({ text, onset, isNote });
    if (isNote) {
      const noteToken = text;
      const durSuffix = noteToken.replace(/^(?:\[[^\]]+\]|![\d]!|[_^=]*[A-Ga-g][,']*|[zx])/, "");
      onset += parseNoteDuration(durSuffix);
    }
  }

  // For each chord, find the closest note token at or after the chord's onset
  const chordInsertions = new Map<number, string>(); // token index → chord prefix

  for (const { chord, onsetUnits } of chordOnsets) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let t = 0; t < tokens.length; t++) {
      if (!tokens[t].isNote) continue;
      const dist = Math.abs(tokens[t].onset - onsetUnits);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = t;
      }
    }

    const existing = chordInsertions.get(bestIdx) || "";
    // Only allow one chord per token position to prevent "D""Em"
    if (!existing) {
      chordInsertions.set(bestIdx, `"${chord}"`);
    }
  }

  // Rebuild the measure with chord symbols inserted
  return tokens.map((token, idx) => {
    const chordPrefix = chordInsertions.get(idx) || "";
    return chordPrefix + token.text;
  }).join("");
}

/**
 * Overlay melody chord symbols onto an instrument's music line,
 * distributing each chord at its correct beat position within each measure.
 */
function overlayMelodyChordsOnInstrumentLine(
  instrumentLine: string,
  melodyLine: string
): string {
  const instrSegments = splitAbcMeasureSegments(instrumentLine);
  const melodySegments = splitAbcMeasureSegments(melodyLine);

  const overlaid = instrSegments.map((seg, i) => {
    const melodySeg = melodySegments[i];
    if (!melodySeg) return seg;
    const chords = extractChordsWithOnsets(melodySeg);
    if (chords.length === 0) return seg;
    return insertChordsIntoMeasure(seg, chords);
  });

  return overlaid.join(" | ");
}

/**
 * Replace all note tokens in an ABC music line with rests of equal duration.
 * Preserves barlines, repeat markers, and other structural tokens.
 * Chord symbols ("Am", "G7", etc.) are also stripped so they don't trigger audio.
 *
 * Example: `"Am"C2 DE | "G"G4` → `z2 zz | z4`
 */
function replaceMelodyNotesWithRests(musicLine: string, showChords: boolean): string {
  // Match either a double-quoted string (to be left intact) OR a note token/chord group (to be replaced)
  return musicLine.replace(
    /"[^"]*"|(\[[^\]|:]+\])([0-9]*(?:\/[0-9]*)?|\/[0-9]*)|([_^=]*[A-Ga-g][,']*)([0-9]*(?:\/[0-9]*)?|\/[0-9]*)/g,
    (match, chordGroup, chordDur, _note, noteDur) => {
      if (match.startsWith('"')) {
        // It's a chord symbol like "Em" or "C", return it as is if showChords is true, otherwise empty string!
        return showChords ? match : "";
      }
      if (chordGroup) {
        // Chord group like [CEG]2 → z2
        return `z${chordDur || ''}`;
      }
      // Single note like C2, ^F, G,4 → z2, z, z4
      return `z${noteDur || ''}`;
    }
  );
}

import type { StrongBeatDirective } from "./abc-beat-annotations";
import {
  normalizeAbcInlineVoiceLine,
  normalizeAbcVoiceDeclarationLine,
  normalizeAbcVoiceId,
  normalizeAbcVoiceSyntax,
} from "./abc-voice-normalization";
import { isAbcLayerVisible } from "./abc-layer-visibility";

export interface BuildAccompanimentAbcOptions {
  baseAbc: string;
  generatedAccompaniment?: string | null;
  generatedGuitar?: string | null;
  generatedPiano?: string | null;
  extraVoiceSources?: Array<string | null | undefined>;
  layerVisibility?: Record<string, boolean>;
  strongBeatDirectives?: StrongBeatDirective[];
  disablePickupLogic?: boolean;
}

export interface AccompanimentVoiceInfo {
  name: string;
  visible: boolean;
}

export interface BuildAccompanimentAbcResult {
  abc: string;
  voiceNames: string[];
  visibleVoiceNames: string[];
}

function getHeaderLines(abcString: string): string[] {
  return abcString.split("\n").filter((line) => /^[A-Z]:/.test(line.trim()) && !/^V:/.test(line.trim()));
}

function isMelodyBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("%")) return false;
  return !/^[A-Za-z]:/.test(trimmed);
}

function getLyricsLineGroups(abcString: string): string[][] {
  const groups: string[][] = [];
  let currentMusicLineIndex = -1;

  for (const line of abcString.split("\n")) {
    if (isMelodyBodyLine(line)) {
      currentMusicLineIndex += 1;
      groups[currentMusicLineIndex] ??= [];
      continue;
    }

    if (/^w:/.test(line.trim()) && currentMusicLineIndex >= 0 && !isStrongBeatLyricLine(line)) {
      groups[currentMusicLineIndex] ??= [];
      groups[currentMusicLineIndex].push(line);
    }
  }

  return groups;
}

function interleaveLyrics(musicLines: string[], lyricsGroups: string[][], beatLyricLines: string[] = []): string[] {
  const output: string[] = [];

  for (let index = 0; index < musicLines.length; index += 1) {
    output.push(musicLines[index]);
    output.push(...(lyricsGroups[index] ?? []));
    const beatLine = beatLyricLines[index];
    if (beatLine) output.push(beatLine);
  }

  for (let index = musicLines.length; index < lyricsGroups.length; index += 1) {
    output.push(...(lyricsGroups[index] ?? []));
  }

  return output;
}

function hasInlineVoiceBody(abcString: string): boolean {
  return abcString.split(/\r?\n/).some((line) => /^\[V:[^\]]+\]/.test(line.trim()));
}

function extractInlineMelodyBlock(abcString: string): string | null {
  if (!hasInlineVoiceBody(abcString)) return null;

  const lines: string[] = [];
  let lastInlineVoiceWasMelody = false;

  for (const rawLine of normalizeAbcVoiceSyntax(abcString).split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    const inlineVoice = normalizeAbcInlineVoiceLine(trimmed).match(/^\[V:([^\]]+)\]\s*(.*)$/);

    if (inlineVoice) {
      const voiceName = normalizeAbcVoiceId(inlineVoice[1]);
      lastInlineVoiceWasMelody = voiceName === "Melody";
      if (lastInlineVoiceWasMelody && inlineVoice[2]?.trim()) {
        lines.push(inlineVoice[2].trim());
      }
      continue;
    }

    if (lastInlineVoiceWasMelody && /^w:/.test(trimmed) && !isStrongBeatLyricLine(trimmed)) {
      lines.push(trimmed);
      continue;
    }

    if (trimmed && !trimmed.startsWith("%") && !/^\+:/.test(trimmed)) {
      lastInlineVoiceWasMelody = false;
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function stripGeneratedHeaders(generatedAccompaniment: string): string {
  return generatedAccompaniment.replace(/^[A-Z]:.*(\r?\n|$)/gm, (match) => {
    if (match.startsWith("V:")) return match;
    return "";
  });
}

function isGuitarLeftHandVoiceLine(voiceLine: string): boolean {
  return /^V:GuitarLeftHand\b/.test(voiceLine) || /\bname="Guitar Left Hand"/.test(voiceLine);
}

function getFriendlyVoiceName(voiceId: string): string {
  const normalized = voiceId.toLowerCase();
  if (normalized === "melody") return "Melody";
  if (normalized.includes("guitar")) return "Guitar";
  if (normalized.includes("piano") || normalized === "accompaniment") return "Piano";
  if (normalized === "harmonium") return "Indian Harmonium";
  if (normalized === "djembe") return "Djembe";
  if (normalized === "flute") return "Flute";
  if (normalized === "violin") return "Violin";
  return voiceId;
}

function normalizeGeneratedVoiceLine(voiceLine: string): string {
  if (isGuitarLeftHandVoiceLine(voiceLine)) {
    return 'V:Harmonium clef=treble name="Indian Harmonium"';
  }

  if (!voiceLine.startsWith("V:Guitar") || voiceLine.includes("name=")) {
    if (voiceLine.includes('name=')) {
      const nameMatch = voiceLine.match(/V:(\S+)/);
      if (nameMatch) {
        const friendlyName = getFriendlyVoiceName(nameMatch[1]);
        return voiceLine.replace(/name="[^"]*"/g, `name="${friendlyName}"`);
      }
    }
    return voiceLine;
  }
  return voiceLine.replace(/V:Guitar clef=treble-8/g, 'V:Guitar clef=treble-8 name="Guitar"');
}

function normalizeMidiDirectives(voiceLine: string, directives: string[]): string[] {
  const nonProgramDirectives = directives.filter((line) => !/^%%MIDI\s+program\b/.test(line));

  if (voiceLine.startsWith("V:Harmonium")) {
    return ["%%MIDI program 20", ...nonProgramDirectives];
  }

  if (voiceLine.startsWith("V:Guitar")) {
    return ["%%MIDI program 24", ...nonProgramDirectives];
  }

  return directives;
}

function splitVoiceBlocks(generatedAccompaniment: string): string[] {
  const normalizedSource = normalizeAbcVoiceSyntax(stripGeneratedHeaders(generatedAccompaniment));
  const voiceBlocks = new Map<string, { voiceLine: string; lines: string[] }>();
  let currentVoiceName: string | null = null;

  const ensureVoiceBlock = (voiceName: string, voiceLine?: string) => {
    const normalizedVoiceName = normalizeAbcVoiceId(voiceName);
    const existing = voiceBlocks.get(normalizedVoiceName);
    if (existing) {
      if (voiceLine) existing.voiceLine = normalizeGeneratedVoiceLine(normalizeAbcVoiceDeclarationLine(voiceLine));
      return existing;
    }

    const block = {
      voiceLine: normalizeGeneratedVoiceLine(voiceLine ? normalizeAbcVoiceDeclarationLine(voiceLine) : `V:${normalizedVoiceName}`),
      lines: [] as string[],
    };
    voiceBlocks.set(normalizedVoiceName, block);
    return block;
  };

  for (const rawLine of normalizedSource.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^%%score\b/.test(trimmed)) continue;

    const voiceDeclaration = trimmed.match(/^V:(\S+)/);
    if (voiceDeclaration) {
      currentVoiceName = normalizeAbcVoiceId(voiceDeclaration[1]);
      ensureVoiceBlock(currentVoiceName, trimmed);
      continue;
    }

    if (/^[A-Z]:/.test(trimmed)) continue;

    const inlineVoiceLine = normalizeAbcInlineVoiceLine(trimmed);
    const inlineVoice = inlineVoiceLine.match(/^\[V:([^\]]+)\]\s*(.*)$/);
    if (inlineVoice) {
      const voiceName = normalizeAbcVoiceId(inlineVoice[1]);
      const block = ensureVoiceBlock(voiceName);
      const bodyLine = inlineVoice[2]?.trim();
      if (bodyLine) block.lines.push(bodyLine);
      currentVoiceName = voiceName;
      continue;
    }

    if (currentVoiceName) {
      ensureVoiceBlock(currentVoiceName).lines.push(trimmed);
    }
  }

  return [...voiceBlocks.values()]
    .map((block) => [block.voiceLine, ...block.lines].join("\n"))
    .filter((block) => block.trim());
}

function getVoiceName(block: string): string | null {
  const match = block.match(/V:(\S+)/);
  return match ? normalizeAbcVoiceId(match[1]) : null;
}

function buildFullMeasureRest(fullMeasureUnits: number): string {
  return `z${formatAbcDuration(fullMeasureUnits)}`;
}

function buildPickupRest(pickupUnits: number): string {
  return `z${formatAbcDuration(pickupUnits)}`;
}

function getMelodyMeasureInfo(baseAbc: string) {
  const durationContext = buildAbcDurationContext(baseAbc);
  const musicBody = extractMusicBodyLines(baseAbc).join(" ");
  const segments = splitAbcMeasureSegments(musicBody);
  const segmentDurations = segments.map((seg) => measureDurationUnits(seg));
  const firstSegmentDuration = segmentDurations.length > 0 ? segmentDurations[0] : 0;
  const hasPickup = firstSegmentDuration > 0 && firstSegmentDuration < durationContext.fullMeasureUnits;
  const fullMeasureCount = hasPickup ? Math.max(segments.length - 1, 0) : segments.length;

  return {
    durationContext,
    hasPickup,
    pickupUnits: hasPickup ? firstSegmentDuration : 0,
    fullMeasureCount,
    segmentDurations,
  };
}

function splitVoiceBodyLines(lines: string[]): { directives: string[]; musicLines: string[] } {
  return lines.reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed) return acc;

    if (trimmed.startsWith("%")) {
      acc.directives.push(trimmed);
    } else {
      acc.musicLines.push(trimmed);
    }

    return acc;
  }, { directives: [] as string[], musicLines: [] as string[] });
}

interface FingerstyleFormSystem {
  label: string;
  position: "before" | "after-line" | "after";
  afterLineIndex?: number;
  melodyLine: string;
  voiceLine: string;
}

interface AlignedVoiceBlock {
  name: string;
  voiceLine: string;
  directives: string[];
  musicLines: string[];
  formSystems?: FingerstyleFormSystem[];
}

function injectMeasuresIntoMelodyLines(
  instrumentMeasures: string[],
  melodyLines: string[]
): string[] {
  const outputLines: string[] = [];
  let instrIndex = 0;

  for (const line of melodyLines) {
    const rawSegments = line.split("|");
    const outputSegments: string[] = [];

    for (const raw of rawSegments) {
      const clean = cleanAbcMeasureSegment(raw);
      if (!clean) {
        outputSegments.push(raw);
        continue;
      }

      const idx = raw.indexOf(clean);
      if (idx !== -1) {
        const prefix = raw.substring(0, idx);
        const suffix = raw.substring(idx + clean.length);

        const replacement = instrumentMeasures[instrIndex] || clean;
        instrIndex++;
        outputSegments.push(prefix + replacement + suffix);
      } else {
        outputSegments.push(raw.replace(clean, instrumentMeasures[instrIndex] || clean));
        instrIndex++;
      }
    }
    outputLines.push(outputSegments.join("|"));
  }

  if (instrIndex < instrumentMeasures.length) {
    const leftover = instrumentMeasures.slice(instrIndex);
    outputLines.push(`| ${leftover.join(" | ")} |`);
  }

  return outputLines;
}

function getMelodyMeasureLinePattern(melodyMusicLines: string[]): number[] {
  return melodyMusicLines
    .map((line) => splitAbcMeasureSegments(line).length)
    .filter((count) => count > 0);
}

function isFingerstyleVoiceBlock(voiceLine: string, lines: string[]): boolean {
  return /Layer 2 Guitar Fingerstyle/.test(voiceLine) || lines.some((line) => line.includes("@fingerstyle-section"));
}

function parseFingerstyleVoiceSections(lines: string[]): { directives: string[]; bodyBars: string[]; introBars: string[]; interludeBars: string[]; outroBars: string[] } {
  let current: "body" | "intro" | "interlude" | "outro" = "body";
  const sections = {
    directives: [] as string[],
    bodyBars: [] as string[],
    introBars: [] as string[],
    interludeBars: [] as string[],
    outroBars: [] as string[],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sectionMatch = trimmed.match(/^%\s*@fingerstyle-section\s+(intro|body|interlude|outro)\b/);
    if (sectionMatch) {
      current = sectionMatch[1] as "body" | "intro" | "interlude" | "outro";
      continue;
    }
    if (trimmed.startsWith("%")) {
      sections.directives.push(trimmed);
      continue;
    }

    const bars = splitAbcMeasureSegments(trimmed);
    if (bars.length === 0) continue;
    if (current === "intro") sections.introBars.push(...bars);
    else if (current === "interlude") sections.interludeBars.push(...bars);
    else if (current === "outro") sections.outroBars.push(...bars);
    else sections.bodyBars.push(...bars);
  }

  return sections;
}

function buildFormSystem(label: string, position: FingerstyleFormSystem["position"], bars: string[], fullMeasureUnits: number, afterLineIndex?: number): FingerstyleFormSystem | null {
  if (bars.length === 0) return null;
  const normalizedBars = bars.map((bar) => normalizeAbcMeasureDuration(bar, fullMeasureUnits));
  const restBars = normalizedBars.map(() => buildFullMeasureRest(fullMeasureUnits));
  return {
    label,
    position,
    afterLineIndex,
    melodyLine: `| ${restBars.join(" | ")} |`,
    voiceLine: `| ${normalizedBars.join(" | ")} |`,
  };
}

function alignVoiceBlockToMelodyLines(block: string, baseAbc: string, melodyLines: string[], disablePickupLogic: boolean = false): AlignedVoiceBlock | null {
  const lines = stripStrongBeatLyricLines(block).split("\n").map(stripBeatAnnotations);
  const voiceLine = normalizeGeneratedVoiceLine(lines[0].trim());
  const name = getVoiceName(voiceLine);
  if (!name) return null;

  const melodyLinePattern = getMelodyMeasureLinePattern(melodyLines);

  const info = getMelodyMeasureInfo(baseAbc);
  const hasPickup = disablePickupLogic ? false : info.hasPickup;
  const pickupUnits = disablePickupLogic ? 0 : info.pickupUnits;
  const fullMeasureCount = disablePickupLogic ? info.durationContext.fullMeasureUnits > 0 ? melodyLinePattern.reduce((a, b) => a + b, 0) : info.fullMeasureCount : info.fullMeasureCount;
  const durationContext = info.durationContext;

  const fallbackMeasure = buildFullMeasureRest(durationContext.fullMeasureUnits);
  const fingerstyle = isFingerstyleVoiceBlock(voiceLine, lines);
  const parsedFingerstyle = fingerstyle ? parseFingerstyleVoiceSections(lines.slice(1)) : null;
  const { directives, musicLines } = parsedFingerstyle
    ? { directives: parsedFingerstyle.directives, musicLines: parsedFingerstyle.bodyBars }
    : splitVoiceBodyLines(lines.slice(1));
  const normalizedDirectives = normalizeMidiDirectives(voiceLine, directives);
  const voiceBody = Array.isArray(musicLines) ? musicLines.join(" ").trim() : "";
  const voiceBars = parsedFingerstyle?.bodyBars ?? splitAbcMeasureSegments(voiceBody);
  let fullMeasureBars = [...voiceBars];
  // When the source has more bars than melody full measures and the melody has a
  // pickup, the extra first bar might be the source's actual pickup tablature (shorter
  // than a full measure). Preserve it if so; otherwise fall back to a pickup rest.
  let pickupBar: string | null = null;
  if (hasPickup && fullMeasureBars.length > fullMeasureCount) {
    const candidatePickup = fullMeasureBars[0];
    const candidateDuration = measureDurationUnits(candidatePickup);
    if (candidateDuration > 0 && candidateDuration <= pickupUnits) {
      // The source's first bar IS a pickup bar — preserve it.
      pickupBar = candidatePickup;
    }
    fullMeasureBars = fullMeasureBars.slice(1);
  }

  while (fullMeasureBars.length < fullMeasureCount) {
    fullMeasureBars.push(fullMeasureBars.at(-1) || fallbackMeasure);
  }

  const normalizedFullMeasures = fullMeasureBars
    .slice(0, fullMeasureCount)
    .map((bar) => normalizeAbcMeasureDuration(bar, durationContext.fullMeasureUnits));
  // Use the source's actual pickup bar if it was a real pickup, otherwise rest.
  const pickupContent = pickupBar ?? buildPickupRest(pickupUnits);
  const alignedMeasures = hasPickup
    ? [pickupContent, ...normalizedFullMeasures]
    : normalizedFullMeasures;

  const interludeAfterLineIndex = Math.max(0, Math.floor(melodyLinePattern.length / 2) - 1);
  const formSystems = parsedFingerstyle
    ? [
        buildFormSystem("Intro", "before", parsedFingerstyle.introBars, durationContext.fullMeasureUnits),
        buildFormSystem("Interlude", "after-line", parsedFingerstyle.interludeBars, durationContext.fullMeasureUnits, interludeAfterLineIndex),
        buildFormSystem("Outro", "after", parsedFingerstyle.outroBars, durationContext.fullMeasureUnits),
      ].filter((system): system is FingerstyleFormSystem => Boolean(system))
    : undefined;

  return {
    name,
    voiceLine,
    directives: normalizedDirectives,
    musicLines: injectMeasuresIntoMelodyLines(alignedMeasures, melodyLines),
    formSystems,
  };
}

export function getLayerVoiceNames(...sources: Array<string | null | undefined>): string[] {
  const names = sources.flatMap((source) =>
    source ? splitVoiceBlocks(source).map(getVoiceName).filter(Boolean) as string[] : []
  );
  return [...new Set(names)];
}

export function getAccompanimentVoiceNames(
  generatedAccompaniment?: string | null,
  generatedGuitar?: string | null,
  generatedPiano?: string | null,
  extraVoiceSources: Array<string | null | undefined> = [],
  baseAbc?: string | null
): string[] {
  return getLayerVoiceNames(baseAbc, generatedAccompaniment, generatedGuitar, generatedPiano, ...extraVoiceSources);
}


export function buildAccompanimentAbc({
  baseAbc,
  generatedAccompaniment,
  generatedGuitar,
  generatedPiano,
  extraVoiceSources = [],
  layerVisibility = {},
  strongBeatDirectives,
  disablePickupLogic = false,
}: BuildAccompanimentAbcOptions): BuildAccompanimentAbcResult {
  const normalizedBaseAbc = normalizeAbcVoiceSyntax(baseAbc);
  const baseAbcBlocks = normalizedBaseAbc.split(/(?=^V:)/m).filter(block => block.trim());
  const inlineMelodyBlock = extractInlineMelodyBlock(normalizedBaseAbc);
  // Merge ALL V:Melody blocks (some ABC files have a declaration block with options/MIDI
  // followed by a second V:Melody that contains the actual music body). Using find() would
  // pick only the first block, which may have no notes.
  const allMelodyBlocks = baseAbcBlocks.filter(b => /^V:Melody\b/.test(b.trim()));
  const mergedMelodyBlock = allMelodyBlocks.length > 0 ? allMelodyBlocks.join("\n") : null;
  const melodyBlock = inlineMelodyBlock
    || mergedMelodyBlock
    || baseAbcBlocks.find(b => !b.trim().startsWith("V:"))
    || "";
  const otherBaseBlocks = hasInlineVoiceBody(normalizedBaseAbc)
    ? [normalizedBaseAbc]
    : baseAbcBlocks.filter(b => b !== melodyBlock && b.trim().startsWith("V:") && !/^V:Melody\b/.test(b.trim()));

  const headerLines = getHeaderLines(normalizedBaseAbc);
  const showChords = layerVisibility.__chords__ !== false;
  const showMelody = layerVisibility.__melody__ !== false;
  const showStrongBeats = layerVisibility.__strong_beats__ === true;
  const showLyrics = isAbcLayerVisible("Lyrics", layerVisibility, true);
  const cleanMelodyBlock = stripStrongBeatLyricLines(melodyBlock);
  const musicLines = extractMusicBodyLines(cleanMelodyBlock).map(stripBeatAnnotations);
  const melodyReferenceAbc = [...headerLines, ...musicLines].join("\n");

  // Build melody lines: strip chords if chord layer is off, replace notes with rests if melody is off
  let melodyMusicLines: string[];
  if (!showMelody) {
    // Replace all notes with rests of equal duration (visual silence on the staff)
    melodyMusicLines = musicLines.map((line) => replaceMelodyNotesWithRests(line, showChords));
  } else if (!showChords) {
    melodyMusicLines = musicLines.map(stripAbcChordSymbols);
  } else {
    melodyMusicLines = musicLines;
  }

  const beatLyricLines = (showStrongBeats && showMelody)
    ? buildStrongBeatLyricLines({ musicLines: melodyMusicLines, baseAbc, directives: strongBeatDirectives })
    : [];

  const melodyOutputLines = interleaveLyrics(
    melodyMusicLines,
    showLyrics ? getLyricsLineGroups(cleanMelodyBlock) : [],
    beatLyricLines
  );

  // Merge all accompaniment sources into a single aligned block list
  const allSources = [
    generatedAccompaniment,
    generatedGuitar,
    generatedPiano,
    ...extraVoiceSources,
    ...otherBaseBlocks
  ].filter(Boolean) as string[];

  if (allSources.length === 0) {
    return {
      abc: [
        ...headerLines,
        (!showChords || !showMelody) ? "%%playchord 0" : "",
        ...melodyOutputLines,
      ].filter(Boolean).join("\n"),
      voiceNames: [],
      visibleVoiceNames: [],
    };
  }

  // Collect all voice blocks from all sources and deduplicate by voice name (last one wins)
  const voiceBlockMap = new Map<string, string>();
  for (const source of allSources) {
    for (const block of splitVoiceBlocks(source)) {
      const name = getVoiceName(block);
      // Skip Melody here to prevent duplicate staves. Melody is handled explicitly via melodyOutputLines
      // and dynamic beat annotations. We do not want accompaniment sources to re-inject raw Melody blocks.
      if (name && name !== "Melody") {
        voiceBlockMap.set(name, block);
      }
    }
  }

  const alignedBlocks = [...voiceBlockMap.values()]
    .map((block) => alignVoiceBlockToMelodyLines(block, melodyReferenceAbc, melodyMusicLines, disablePickupLogic))
    .filter(Boolean) as AlignedVoiceBlock[];
  const voiceNames = alignedBlocks.map((block) => block.name);
  const visibleBlocks = alignedBlocks.filter((block) => layerVisibility[block.name] !== false);
  const visibleVoiceNames = visibleBlocks.map((block) => block.name);

  // When Melody is hidden and there are visible instrument blocks, promote the
  // first visible instrument to be the primary voice. The Melody voice is omitted
  // from %%score and the promoted instrument carries lyrics, chords, and beats.
  const melodyHiddenWithInstruments = !showMelody && visibleBlocks.length > 0;
  const promotedVoiceName = melodyHiddenWithInstruments ? visibleBlocks[0].name : null;

  // Build score parts: include Melody only when it is shown (or no instruments to promote to)
  const scoreParts: string[] = melodyHiddenWithInstruments
    ? visibleVoiceNames.map((voiceName) => `(${voiceName})`)
    : ["(Melody)", ...visibleVoiceNames.map((voiceName) => `(${voiceName})`)];

  const output = [...headerLines];
  if (scoreParts.length > 0) {
    output.push(`%%score ${scoreParts.join(" ")}`);
  }
  // Inject vocalspace to ensure the lyrics clear the downward stems exactly.
  // The CSS translateY(-40px) pulls the Tablature UP to meet the lyrics.
  if (visibleVoiceNames.includes("Guitar")) {
    output.push("%%vocalspace 10");
    output.push("%%botmargin 80");
  }

  const lyricsGroups = showLyrics ? getLyricsLineGroups(cleanMelodyBlock) : [];

  // Define all voices first, then interleave the body by visual staff system:
  // Melody line N, lyric/beat helper lines for that same melody line, then every visible
  // accompaniment/ensemble voice line N. This keeps abcjs rendering/playback aligned when
  // the source melody has multiple visual lines.
  if (!melodyHiddenWithInstruments) {
    output.push('V:Melody name="Melody" stem=up');
  }
  const processedVisibleBlocks = visibleBlocks.map((block) => {
    const friendlyName = getFriendlyVoiceName(block.name);
    let voiceLine = block.voiceLine;

    // Ensure it uses the friendly display name
    if (voiceLine.includes('name=')) {
      voiceLine = voiceLine.replace(/name="[^"]*"/g, `name="${friendlyName}"`);
    } else {
      voiceLine = voiceLine.replace(/^(V:\S+)/, `$1 name="${friendlyName}"`);
    }

    // When this block is the promoted primary voice (melody hidden), give it stem=up
    // like the melody would have, so it looks like the main staff.
    if (block.name === promotedVoiceName) {
      // Remove any existing stem directive and add stem=up
      voiceLine = voiceLine.replace(/\s*stem=\S+/g, "");
      voiceLine += " stem=up";
    } else if (block.name === "Guitar" && !voiceLine.includes("stem=")) {
      voiceLine += " stem=down";
    }

    return {
      ...block,
      voiceLine,
      musicLines: block.musicLines.map((line) => stripBeatAnnotations(stripStrongBeatLyricLines(line))),
    };
  });

  for (const block of processedVisibleBlocks) {
    output.push(block.voiceLine, ...block.directives);
  }

  const emitFormSystems = (position: FingerstyleFormSystem["position"], afterLineIndex?: number) => {
    for (const block of processedVisibleBlocks) {
      for (const system of block.formSystems ?? []) {
        if (system.position !== position) continue;
        if (position === "after-line" && system.afterLineIndex !== afterLineIndex) continue;
        output.push(`% ${system.label}: Guitar Fingerstyle form section with Melody rests.`);
        if (!melodyHiddenWithInstruments) {
          output.push(`[V:Melody] ${system.melodyLine}`);
        }
        output.push(`[V:${block.name}] ${system.voiceLine}`);
      }
    }
  };

  emitFormSystems("before");

  // Build strong beat lines for the promoted voice when melody is hidden
  const promotedBeatLyricLines = (melodyHiddenWithInstruments && showStrongBeats && promotedVoiceName)
    ? buildStrongBeatLyricLines({ musicLines: musicLines, baseAbc, directives: strongBeatDirectives })
    : [];

  for (let lineIndex = 0; lineIndex < melodyMusicLines.length; lineIndex += 1) {
    if (melodyHiddenWithInstruments) {
      // Melody is hidden: the promoted instrument is the main voice.
      // Emit staff system comment without mentioning Melody.
      output.push(`% Staff system ${lineIndex + 1}: Primary instrument and visible layers share this measure range.`);

      for (const block of processedVisibleBlocks) {
        let voiceLine = block.musicLines[lineIndex];
        if (!voiceLine) continue;

        if (block.name === promotedVoiceName) {
          // Overlay chord symbols from the original melody at their correct beat positions
          if (showChords) {
            voiceLine = overlayMelodyChordsOnInstrumentLine(voiceLine, musicLines[lineIndex]);
          }
          output.push(`[V:${block.name}] ${voiceLine}`);
          // Attach lyrics to the promoted voice
          output.push(...(lyricsGroups[lineIndex] ?? []));
          // Attach strong beat annotations to the promoted voice
          const beatLine = promotedBeatLyricLines[lineIndex];
          if (beatLine) output.push(beatLine);
        } else {
          output.push(`[V:${block.name}] ${voiceLine}`);
        }
      }
    } else {
      // Normal mode: Melody is the primary voice
      output.push(`% Staff system ${lineIndex + 1}: Melody and visible instruments share this measure range.`);
      output.push(`[V:Melody] ${melodyMusicLines[lineIndex]}`);
      output.push(...(lyricsGroups[lineIndex] ?? []));
      const beatLine = beatLyricLines[lineIndex];
      if (beatLine) output.push(beatLine);

      for (const block of processedVisibleBlocks) {
        const voiceLine = block.musicLines[lineIndex];
        if (voiceLine) output.push(`[V:${block.name}] ${voiceLine}`);
      }
    }

    emitFormSystems("after-line", lineIndex);
  }

  emitFormSystems("after");

  for (let lineIndex = melodyMusicLines.length; lineIndex < lyricsGroups.length; lineIndex += 1) {
    output.push(...(lyricsGroups[lineIndex] ?? []));
  }

  const finalAbcOutput = output.join("\n");

  return {
    abc: finalAbcOutput,
    voiceNames,
    visibleVoiceNames,
  };
}

