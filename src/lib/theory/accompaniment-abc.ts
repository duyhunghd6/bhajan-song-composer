import {
  buildAbcDurationContext,
  extractMusicBodyLines,
  formatAbcDuration,
  measureDurationUnits,
  normalizeAbcMeasureDuration,
  splitAbcMeasureSegments,
  stripAbcChordSymbols,
} from "./abc-duration";
import { annotateStrongBeatIndicators, stripBeatAnnotations } from "./abc-beat-annotations";

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

export interface BuildAccompanimentAbcOptions {
  baseAbc: string;
  generatedAccompaniment?: string | null;
  generatedGuitar?: string | null;
  generatedPiano?: string | null;
  extraVoiceSources?: Array<string | null | undefined>;
  layerVisibility?: Record<string, boolean>;
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

function getLyricsLines(abcString: string): string[] {
  return abcString.split("\n").filter((line) => /^w:/.test(line.trim()));
}

function interleaveLyrics(musicLines: string[], lyricsLines: string[]): string[] {
  const output: string[] = [];
  let lyricsIndex = 0;

  for (const musicLine of musicLines) {
    output.push(musicLine);
    if (lyricsIndex < lyricsLines.length) {
      output.push(lyricsLines[lyricsIndex]);
      lyricsIndex += 1;
    }
  }

  while (lyricsIndex < lyricsLines.length) {
    output.push(lyricsLines[lyricsIndex]);
    lyricsIndex += 1;
  }

  return output;
}

function stripGeneratedHeaders(generatedAccompaniment: string): string {
  return generatedAccompaniment.replace(/^[A-Z]:.*(\r?\n|$)/gm, (match) => {
    if (match.startsWith("V:")) return match;
    return "";
  });
}

function normalizeGeneratedVoiceLine(voiceLine: string): string {
  if (!voiceLine.startsWith("V:Guitar") || voiceLine.includes("name=")) return voiceLine;
  return voiceLine.replace(/V:Guitar clef=treble-8/g, 'V:Guitar clef=treble-8 name="Layer 2 Guitar Accompaniment"');
}

function splitVoiceBlocks(generatedAccompaniment: string): string[] {
  const body = normalizeGeneratedVoiceLine(stripGeneratedHeaders(generatedAccompaniment));
  return body.split(/(?=V:)/).filter((block) => block.trim());
}

function getVoiceName(block: string): string | null {
  return block.match(/V:(\S+)/)?.[1] ?? null;
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

function alignVoiceBlock(block: string, baseAbc: string): string {
  const lines = block.split("\n");
  const voiceLine = normalizeGeneratedVoiceLine(lines[0].trim());
  const voiceBody = lines.slice(1).join(" ").trim();
  const voiceBars = splitAbcMeasureSegments(voiceBody);
  const { durationContext, hasPickup, pickupUnits, fullMeasureCount } = getMelodyMeasureInfo(baseAbc);
  const fallbackMeasure = buildFullMeasureRest(durationContext.fullMeasureUnits);
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

  if (hasPickup) {
    return `${voiceLine}\n${buildPickupRest(pickupUnits)} | ${normalizedFullMeasures.join(" | ")} |`;
  }

  return `${voiceLine}\n| ${normalizedFullMeasures.join(" | ")} |`;
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
): string[] {
  return getLayerVoiceNames(generatedAccompaniment, generatedGuitar, generatedPiano, ...extraVoiceSources);
}

export function buildAccompanimentAbc({
  baseAbc,
  generatedAccompaniment,
  generatedGuitar,
  generatedPiano,
  extraVoiceSources = [],
  layerVisibility = {},
}: BuildAccompanimentAbcOptions): BuildAccompanimentAbcResult {
  const baseAbcBlocks = baseAbc.split(/(?=^V:)/m).filter(block => block.trim());
  const melodyBlock = baseAbcBlocks.find(b => b.startsWith("V:Melody")) 
    || baseAbcBlocks.find(b => !b.startsWith("V:")) 
    || "";
  const otherBaseBlocks = baseAbcBlocks.filter(b => b !== melodyBlock && b.startsWith("V:") && !b.startsWith("V:Melody"));

  const headerLines = getHeaderLines(baseAbc);
  const showChords = layerVisibility.__chords__ !== false;
  const showMelody = layerVisibility.__melody__ !== false;
  const showStrongBeats = layerVisibility.__strong_beats__ === true;
  const musicLines = extractMusicBodyLines(melodyBlock).map(stripBeatAnnotations);

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

  if (showStrongBeats && showMelody) {
    melodyMusicLines = annotateStrongBeatIndicators({ musicLines: melodyMusicLines, baseAbc });
  }

  const melodyOutputLines = interleaveLyrics(melodyMusicLines, showMelody ? getLyricsLines(melodyBlock) : []);

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
      if (name) {
        voiceBlockMap.set(name, block);
      }
    }
  }

  const alignedBlocks = [...voiceBlockMap.values()].map((block) => alignVoiceBlock(block, baseAbc));
  const voiceNames = alignedBlocks.map(getVoiceName).filter(Boolean) as string[];
  const visibleBlocks = alignedBlocks.filter((block) => {
    const voiceName = getVoiceName(block);
    return !voiceName || layerVisibility[voiceName] !== false;
  });
  const visibleVoiceNames = visibleBlocks.map(getVoiceName).filter(Boolean) as string[];

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

  // Melody stems point UP, Guitar stems point DOWN for clean fingerstyle visual
  output.push('V:Melody name="Original Melody" stem=up');
  output.push(...melodyOutputLines);
  
  const processedVisibleBlocks = visibleBlocks.map(block => {
    if (getVoiceName(block) === "Guitar") {
      // Find the V:Guitar line and append stem=down if not already present
      return block.replace(/^(V:Guitar.*?)$/m, (match) => {
        return match.includes('stem=') ? match : `${match} stem=down`;
      });
    }
    return block;
  });
  
  output.push(...processedVisibleBlocks);

  return {
    abc: output.join("\n"),
    voiceNames,
    visibleVoiceNames,
  };
}

