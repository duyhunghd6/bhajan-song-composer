import {
  buildAbcDurationContext,
  extractMusicBodyLines,
  formatAbcDuration,
  measureDurationUnits,
  normalizeAbcMeasureDuration,
  splitAbcMeasureSegments,
  stripAbcChordSymbols,
} from "./abc-duration";
import {
  buildStrongBeatLyricLines,
  isStrongBeatLyricLine,
  stripBeatAnnotations,
  stripStrongBeatLyricLines,
} from "./abc-beat-annotations";

/**
 * Replace all note tokens in an ABC music line with rests of equal duration.
 * Preserves barlines, repeat markers, and other structural tokens.
 * Chord symbols ("Am", "G7", etc.) are also stripped so they don't trigger audio.
 *
 * Example: `"Am"C2 DE | "G"G4` → `z2 zz | z4`
 */
function replaceMelodyNotesWithRests(musicLine: string): string {
  // First strip chord symbols, then replace note tokens with rests
  const stripped = stripAbcChordSymbols(musicLine);
  // Match ABC note tokens: optional accidental, note letter, optional octave marks, optional duration
  // Also match chord groups like [CEG]2
  return stripped.replace(
    /(\[[^\]|:]+\])([0-9]*(?:\/[0-9]*)?|\/[0-9]*)|([_^=]*[A-Ga-g][,']*)([0-9]*(?:\/[0-9]*)?|\/[0-9]*)/g,
    (_match, chordGroup, chordDur, _note, noteDur) => {
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

export interface BuildAccompanimentAbcOptions {
  baseAbc: string;
  generatedAccompaniment?: string | null;
  generatedGuitar?: string | null;
  generatedPiano?: string | null;
  extraVoiceSources?: Array<string | null | undefined>;
  layerVisibility?: Record<string, boolean>;
  strongBeatDirectives?: StrongBeatDirective[];
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
  return abcString.split("\n").filter((line) => /^[A-Z]:/.test(line.trim()));
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

function normalizeGeneratedVoiceLine(voiceLine: string): string {
  if (isGuitarLeftHandVoiceLine(voiceLine)) {
    return 'V:Harmonium clef=treble name="Layer 2 Harmonium Accompaniment"';
  }

  if (!voiceLine.startsWith("V:Guitar") || voiceLine.includes("name=")) return voiceLine;
  return voiceLine.replace(/V:Guitar clef=treble-8/g, 'V:Guitar clef=treble-8 name="Layer 2 Guitar Accompaniment"');
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
  const firstSegmentDuration = segments.length > 0 ? measureDurationUnits(segments[0]) : 0;
  const hasPickup = firstSegmentDuration > 0 && firstSegmentDuration < durationContext.fullMeasureUnits;
  const fullMeasureCount = hasPickup ? Math.max(segments.length - 1, 0) : segments.length;

  return {
    durationContext,
    hasPickup,
    pickupUnits: hasPickup ? firstSegmentDuration : 0,
    fullMeasureCount,
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

function regroupMeasureSegmentsForMelodyLines(
  measures: string[],
  pattern: number[],
  firstLineStartsWithPickup = false
): string[] {
  const effectivePattern = pattern.length > 0 ? pattern : [Math.max(measures.length, 1)];
  const output: string[] = [];
  let cursor = 0;

  for (let lineIndex = 0; lineIndex < effectivePattern.length; lineIndex += 1) {
    const count = effectivePattern[lineIndex];
    const group = measures.slice(cursor, cursor + count);
    if (group.length === 0) break;
    const joinedGroup = group.join(" | ");
    output.push(lineIndex === 0 && firstLineStartsWithPickup ? `${joinedGroup} |` : `| ${joinedGroup} |`);
    cursor += count;
  }

  if (cursor < measures.length) {
    output.push(`| ${measures.slice(cursor).join(" | ")} |`);
  }

  return output;
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

function alignVoiceBlockToMelodyLines(block: string, baseAbc: string, melodyLinePattern: number[]): AlignedVoiceBlock | null {
  const lines = stripStrongBeatLyricLines(block).split("\n").map(stripBeatAnnotations);
  const voiceLine = normalizeGeneratedVoiceLine(lines[0].trim());
  const name = getVoiceName(voiceLine);
  if (!name) return null;

  const { durationContext, hasPickup, pickupUnits, fullMeasureCount } = getMelodyMeasureInfo(baseAbc);
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

  if (hasPickup && fullMeasureBars.length > fullMeasureCount) {
    fullMeasureBars = fullMeasureBars.slice(1);
  }

  while (fullMeasureBars.length < fullMeasureCount) {
    fullMeasureBars.push(fullMeasureBars.at(-1) || fallbackMeasure);
  }

  const normalizedFullMeasures = fullMeasureBars
    .slice(0, fullMeasureCount)
    .map((bar) => normalizeAbcMeasureDuration(bar, durationContext.fullMeasureUnits));
  const alignedMeasures = hasPickup
    ? [buildPickupRest(pickupUnits), ...normalizedFullMeasures]
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
    musicLines: regroupMeasureSegmentsForMelodyLines(alignedMeasures, melodyLinePattern, hasPickup),
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
}: BuildAccompanimentAbcOptions): BuildAccompanimentAbcResult {
  const normalizedBaseAbc = normalizeAbcVoiceSyntax(baseAbc);
  const baseAbcBlocks = normalizedBaseAbc.split(/(?=^V:)/m).filter(block => block.trim());
  const inlineMelodyBlock = extractInlineMelodyBlock(normalizedBaseAbc);
  const melodyBlock = inlineMelodyBlock
    || baseAbcBlocks.find(b => /^V:Melody\b/.test(b.trim()))
    || baseAbcBlocks.find(b => !b.trim().startsWith("V:"))
    || "";
  const otherBaseBlocks = hasInlineVoiceBody(normalizedBaseAbc)
    ? [normalizedBaseAbc]
    : baseAbcBlocks.filter(b => b !== melodyBlock && b.trim().startsWith("V:") && !/^V:Melody\b/.test(b.trim()));

  const headerLines = getHeaderLines(normalizedBaseAbc);
  const showChords = layerVisibility.__chords__ !== false;
  const showMelody = layerVisibility.__melody__ !== false;
  const showStrongBeats = layerVisibility.__strong_beats__ === true;
  const cleanMelodyBlock = stripStrongBeatLyricLines(melodyBlock);
  const musicLines = extractMusicBodyLines(cleanMelodyBlock).map(stripBeatAnnotations);
  const melodyReferenceAbc = [...headerLines, ...musicLines].join("\n");

  // Build melody lines: strip chords if chord layer is off, replace notes with rests if melody is off
  let melodyMusicLines: string[];
  if (!showMelody) {
    // Replace all notes with rests of equal duration (visual silence on the staff)
    // Also strips chord symbols so they don't trigger audio playback
    melodyMusicLines = musicLines.map(replaceMelodyNotesWithRests);
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
    showMelody ? getLyricsLineGroups(cleanMelodyBlock) : [],
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

  const melodyLinePattern = getMelodyMeasureLinePattern(melodyMusicLines);
  const alignedBlocks = [...voiceBlockMap.values()]
    .map((block) => alignVoiceBlockToMelodyLines(block, melodyReferenceAbc, melodyLinePattern))
    .filter(Boolean) as AlignedVoiceBlock[];
  const voiceNames = alignedBlocks.map((block) => block.name);
  const visibleBlocks = alignedBlocks.filter((block) => layerVisibility[block.name] !== false);
  const visibleVoiceNames = visibleBlocks.map((block) => block.name);

  // Always include Melody in score so the staff stays visible (rests show the silent voice)
  const scoreParts: string[] = [];
  if (visibleVoiceNames.includes("Guitar")) {
    // Merge Melody and Guitar onto a single staff so the Tablature plugin reads both!
    scoreParts.push("(Melody Guitar)");
    scoreParts.push(...visibleVoiceNames.filter(v => v !== "Guitar").map((v) => `(${v})`));
  } else {
    scoreParts.push("(Melody)");
    scoreParts.push(...visibleVoiceNames.map((voiceName) => `(${voiceName})`));
  }

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

  const lyricsGroups = showMelody ? getLyricsLineGroups(cleanMelodyBlock) : [];

  // Define all voices first, then interleave the body by visual staff system:
  // Melody line N, lyric/beat helper lines for that same melody line, then every visible
  // accompaniment/ensemble voice line N. This keeps abcjs rendering/playback aligned when
  // the source melody has multiple visual lines.
  output.push('V:Melody name="Original Melody" stem=up');
  const processedVisibleBlocks = visibleBlocks.map((block) => {
    const voiceLine = block.name === "Guitar" && !block.voiceLine.includes("stem=")
      ? `${block.voiceLine} stem=down`
      : block.voiceLine;
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
        output.push(`[V:Melody] ${system.melodyLine}`);
        output.push(`[V:${block.name}] ${system.voiceLine}`);
      }
    }
  };

  emitFormSystems("before");

  for (let lineIndex = 0; lineIndex < melodyMusicLines.length; lineIndex += 1) {
    output.push(`% Staff system ${lineIndex + 1}: Melody and visible instruments share this measure range.`);
    output.push(`[V:Melody] ${melodyMusicLines[lineIndex]}`);
    output.push(...(lyricsGroups[lineIndex] ?? []));
    const beatLine = beatLyricLines[lineIndex];
    if (beatLine) output.push(beatLine);

    for (const block of processedVisibleBlocks) {
      const voiceLine = block.musicLines[lineIndex];
      if (voiceLine) output.push(`[V:${block.name}] ${voiceLine}`);
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

