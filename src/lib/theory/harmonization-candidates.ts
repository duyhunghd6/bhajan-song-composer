import abcjs from "abcjs";
import { z } from "zod";
import { getDiatonicChords } from "./chords";
import { analyzeMelody, normalizeAbcNote, parseAbcHeader } from "./melody-analyzer";
import { parseRootAndMode } from "./harmonizer";

export const HARMONIZATION_CANDIDATE_STYLES = [
  "simple-devotional",
  "emotional-ballad",
  "raga-aware-minimal",
  "western-functional",
  "rich-reharmonization",
] as const;

export type HarmonizationCandidateStyle = (typeof HARMONIZATION_CANDIDATE_STYLES)[number];

export interface HarmonizeMetadata {
  key: string;
  scale: string;
  timeSignature: string;
  raga?: string;
  taal?: string;
  title?: string;
  language?: string;
  devotionalMood?: string;
  constraints?: string[];
}

export interface HarmonizationOption {
  id: string;
  label: string;
  style: HarmonizationCandidateStyle | string;
  progression: string[];
  romanNumerals: string[];
  explanation: string;
  harmonizedAbc: string;
  confidence: number;
  warnings: string[];
  validationNotes: string[];
  progression_name: string;
  abc: string;
}

export interface HarmonizeResult {
  detectedKey: string;
  detectedScale: string;
  timeSignature: string;
  options: HarmonizationOption[];
}

export class HarmonizationValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid harmonization response: ${issues.join("; ")}`);
    this.name = "HarmonizationValidationError";
  }
}

interface MelodySignatureToken {
  type: "note" | "rest" | "bar";
  value: string;
  duration?: string;
}

const RawOptionSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  style: z.string().optional(),
  progression: z.array(z.string()).optional(),
  romanNumerals: z.array(z.string()).optional(),
  explanation: z.string(),
  harmonizedAbc: z.string().optional(),
  confidence: z.number().optional(),
  warnings: z.array(z.string()).optional(),
  validationNotes: z.array(z.string()).optional(),
  progression_name: z.string().optional(),
  abc: z.string().optional(),
});

const RawResultSchema = z.object({
  detectedKey: z.string().optional(),
  detectedScale: z.string().optional(),
  timeSignature: z.string().optional(),
  options: z.array(RawOptionSchema),
});

const NOTE_VALUE_BY_NAME: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

const NOTE_NAME_BY_VALUE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function normalizeChordLabel(chord: string): string {
  return chord.trim().replace(/\s+/g, "").replace(/♯/g, "#").replace(/♭/g, "b");
}

function normalizeProgressionKey(progression: string[]): string {
  return progression.map((chord) => normalizeChordLabel(chord).toLowerCase()).join("|");
}

function stripHtml(content: string): string {
  return content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function stripQuotedText(content: string): string {
  return content.replace(/"[^"]*"/g, "");
}

function bodyForMelodySignature(abc: string): string {
  return abc
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || line.startsWith("%")) return false;
      if (/^[A-Za-z]:/.test(line)) return false;
      if (/^%%/.test(line)) return false;
      return true;
    })
    .map(stripQuotedText)
    .join(" ");
}

function extractMelodySignature(abc: string): MelodySignatureToken[] {
  const body = bodyForMelodySignature(abc);
  const tokens: MelodySignatureToken[] = [];
  const tokenRegex = /\|+|:?\|:?|\[\|?|\|?\]|([_^=]?[A-Ga-g][,']*)([0-9]*\/?[0-9]*)|([zx])([0-9]*\/?[0-9]*)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(body)) !== null) {
    const raw = match[0];
    if (raw.includes("|") || raw === "[") {
      tokens.push({ type: "bar", value: "|" });
      continue;
    }

    if (match[1]) {
      tokens.push({
        type: "note",
        value: normalizeAbcNote(match[1]),
        duration: match[2] || "1",
      });
      continue;
    }

    if (match[3]) {
      tokens.push({
        type: "rest",
        value: match[3],
        duration: match[4] || "1",
      });
    }
  }

  return collapseBars(tokens);
}

function collapseBars(tokens: MelodySignatureToken[]): MelodySignatureToken[] {
  const collapsed: MelodySignatureToken[] = [];
  for (const token of tokens) {
    if (token.type === "bar" && collapsed[collapsed.length - 1]?.type === "bar") continue;
    collapsed.push(token);
  }
  return collapsed;
}

function signaturesEqual(left: MelodySignatureToken[], right: MelodySignatureToken[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((token, index) => {
    const other = right[index];
    return token.type === other.type && token.value === other.value && token.duration === other.duration;
  });
}

function hasNewVoiceDefinitions(sourceAbc: string, candidateAbc: string): boolean {
  const sourceVoices = new Set(sourceAbc.match(/^\s*V:\s*\S+/gm) ?? []);
  const candidateVoices = candidateAbc.match(/^\s*V:\s*\S+/gm) ?? [];
  return candidateVoices.some((voice) => !sourceVoices.has(voice));
}

function hasNewInlineVoiceSwitches(sourceAbc: string, candidateAbc: string): boolean {
  const sourceSwitches = new Set(sourceAbc.match(/\[V:[^\]]+\]/g) ?? []);
  const candidateSwitches = candidateAbc.match(/\[V:[^\]]+\]/g) ?? [];
  return candidateSwitches.some((voice) => !sourceSwitches.has(voice));
}

function hasNewScoreDirectives(sourceAbc: string, candidateAbc: string): boolean {
  if (!/^\s*%%score\b/m.test(candidateAbc)) return false;
  return !/^\s*%%score\b/m.test(sourceAbc);
}

function hasNewBassClef(sourceAbc: string, candidateAbc: string): boolean {
  if (!/clef\s*=\s*bass/i.test(candidateAbc)) return false;
  return !/clef\s*=\s*bass/i.test(sourceAbc);
}

function hasNewVoiceOverlay(sourceAbc: string, candidateAbc: string): boolean {
  if (!/(^|\s)&(\s|$|\\)/.test(candidateAbc)) return false;
  return !/(^|\s)&(\s|$|\\)/.test(sourceAbc);
}

function hasNewNoteChordBlocks(sourceAbc: string, candidateAbc: string): boolean {
  const noteChordBlockRegex = /\[[^\]\n]*[A-Ga-g][^\]\n]*\]/g;
  const sourceBlocks = new Set(sourceAbc.match(noteChordBlockRegex) ?? []);
  const candidateBlocks = candidateAbc.match(noteChordBlockRegex) ?? [];
  return candidateBlocks.some((block) => !sourceBlocks.has(block));
}

export function validateNoNewAccompaniment(sourceAbc: string, candidateAbc: string): string[] {
  const issues: string[] = [];

  if (hasNewVoiceDefinitions(sourceAbc, candidateAbc)) issues.push("candidate adds a new V: voice");
  if (hasNewInlineVoiceSwitches(sourceAbc, candidateAbc)) issues.push("candidate adds a new inline [V:] voice switch");
  if (hasNewScoreDirectives(sourceAbc, candidateAbc)) issues.push("candidate adds a %%score directive");
  if (hasNewBassClef(sourceAbc, candidateAbc)) issues.push("candidate adds a bass clef/accompaniment staff");
  if (hasNewVoiceOverlay(sourceAbc, candidateAbc)) issues.push("candidate adds a multi-voice overlay");
  if (hasNewNoteChordBlocks(sourceAbc, candidateAbc)) issues.push("candidate adds bracketed note chords/accompaniment notes");

  return issues;
}

export function validateAbcParseability(abc: string): string[] {
  const issues: string[] = [];

  if (!abc.trim()) return ["ABC notation is empty"];

  for (const header of ["X", "T", "M", "K"]) {
    if (!new RegExp(`^${header}:\\s*\\S+`, "m").test(abc)) {
      issues.push(`ABC notation is missing required ${header}: header`);
    }
  }

  try {
    const tunes = abcjs.parseOnly(abc);
    if (!Array.isArray(tunes) || tunes.length === 0) {
      issues.push("ABC parser did not produce a tune");
    }

    const warnings = tunes.flatMap((tune) => tune.warnings ?? []);
    issues.push(...warnings.map((warning) => `ABC parser warning: ${stripHtml(String(warning))}`));
  } catch (error) {
    issues.push(error instanceof Error ? `ABC notation could not be parsed: ${error.message}` : "ABC notation could not be parsed");
  }

  return issues;
}

function isChordSymbol(symbol: string): boolean {
  const trimmed = symbol.trim();
  if (!trimmed || /^[\^_<>@]/.test(trimmed)) return false;
  if (/^(rit\.?|accel\.?|fine|dc|d\.c\.|ds|d\.s\.|coda|segno)$/i.test(trimmed)) return false;
  return /^[A-G](?:#|b)?(?:m|min|maj|dim|aug|sus|add|no|\+|°|ø|\d|\(|\)|\/|-)*$/i.test(trimmed) || /^N\.?C\.?$/i.test(trimmed);
}

export function extractChordSymbolsByMeasure(abc: string): string[][] {
  const body = abc
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !/^[A-Za-z]:/.test(line))
    .join(" ");

  return body.split(/[|\]]/).map((measure) => {
    const chords: string[] = [];
    const chordRegex = /"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = chordRegex.exec(measure)) !== null) {
      if (isChordSymbol(match[1])) chords.push(match[1].trim());
    }
    return chords;
  }).filter((measureChords) => measureChords.length > 0);
}

function transpose(root: string, semitones: number): string {
  const normalizedRoot = normalizeAbcNote(root);
  const value = NOTE_VALUE_BY_NAME[normalizedRoot];
  if (value === undefined) return normalizedRoot;
  return NOTE_NAME_BY_VALUE[(value + semitones + 120) % 12];
}

function parseChordTones(chordName: string, metadata: HarmonizeMetadata): string[] {
  const normalizedChord = normalizeChordLabel(chordName);
  const rootMatch = normalizedChord.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!rootMatch) return [];

  const [, root, suffixRaw] = rootMatch;
  const suffix = suffixRaw.split("/")[0].toLowerCase();
  const { root: keyRoot, mode } = parseRootAndMode(metadata.key);
  const diatonic = getDiatonicChords(keyRoot, metadata.scale || mode);
  const exact = diatonic.find((candidate) => normalizeChordLabel(candidate.chordName).toLowerCase() === normalizedChord.toLowerCase());
  if (exact) return exact.notes.map(normalizeAbcNote);

  let intervals = [0, 4, 7];
  if (suffix.includes("dim") || suffix.includes("°")) intervals = [0, 3, 6];
  else if (suffix.includes("aug") || suffix.includes("+")) intervals = [0, 4, 8];
  else if (suffix.includes("sus2")) intervals = [0, 2, 7];
  else if (suffix.includes("sus4") || suffix.includes("sus")) intervals = [0, 5, 7];
  else if (suffix.startsWith("m") && !suffix.startsWith("maj")) intervals = [0, 3, 7];

  if (suffix.includes("maj7")) intervals = [...intervals, 11];
  else if (suffix.includes("7")) intervals = [...intervals, 10];
  else if (suffix.includes("6")) intervals = [...intervals, 9];

  if (suffix.includes("9")) intervals = [...intervals, 2];
  if (suffix.includes("11")) intervals = [...intervals, 5];
  if (suffix.includes("13")) intervals = [...intervals, 9];

  return Array.from(new Set(intervals.map((interval) => normalizeAbcNote(transpose(root, interval)))));
}

export function validateStrongBeatSupport(option: HarmonizationOption, sourceAbc: string, metadata: HarmonizeMetadata): string[] {
  const warnings: string[] = [];
  const analysis = analyzeMelody(sourceAbc);
  const chordsByMeasure = extractChordSymbolsByMeasure(option.harmonizedAbc);

  if (chordsByMeasure.length === 0) {
    return ["candidate has no chord symbols to validate against strong beats"];
  }

  let supportedStrongBeatCount = 0;

  for (const measure of analysis.measures) {
    const chordName = chordsByMeasure[measure.measureIndex]?.[0] ?? option.progression[measure.measureIndex];
    if (!chordName) {
      warnings.push(`measure ${measure.measureIndex + 1} has no chord for strong-beat validation`);
      continue;
    }

    const chordTones = parseChordTones(chordName, metadata);
    if (chordTones.length === 0) {
      warnings.push(`measure ${measure.measureIndex + 1} chord ${chordName} could not be analyzed`);
      continue;
    }

    for (const note of measure.strongBeatNotes) {
      const normalized = normalizeAbcNote(note);
      if (chordTones.includes(normalized)) {
        supportedStrongBeatCount += 1;
      } else {
        warnings.push(`measure ${measure.measureIndex + 1} strong-beat note ${note} is not in chord ${chordName}`);
      }
    }
  }

  if (supportedStrongBeatCount === 0) {
    warnings.unshift("no strong-beat melody notes are supported by candidate chord tones");
  }

  return warnings;
}

function validateMelodyPreserved(sourceAbc: string, candidateAbc: string): string[] {
  const sourceSignature = extractMelodySignature(sourceAbc);
  const candidateSignature = extractMelodySignature(candidateAbc);
  return signaturesEqual(sourceSignature, candidateSignature) ? [] : ["candidate changes melody notes, rests, durations, or bar structure"];
}

function normalizeOption(raw: z.infer<typeof RawOptionSchema>, index: number): HarmonizationOption {
  const style = raw.style?.trim() || HARMONIZATION_CANDIDATE_STYLES[index] || `candidate-${index + 1}`;
  const label = raw.label?.trim() || raw.progression_name?.trim() || style.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const harmonizedAbc = raw.harmonizedAbc ?? raw.abc ?? "";
  const confidence = raw.confidence ?? 0.5;

  return {
    id: raw.id?.trim() || style,
    label,
    style,
    progression: raw.progression ?? [],
    romanNumerals: raw.romanNumerals ?? [],
    explanation: raw.explanation,
    harmonizedAbc,
    confidence,
    warnings: raw.warnings ?? [],
    validationNotes: raw.validationNotes ?? [],
    progression_name: raw.progression_name?.trim() || label,
    abc: raw.abc ?? harmonizedAbc,
  };
}

export function normalizeHarmonizeResult(raw: unknown, sourceAbc: string, metadata: HarmonizeMetadata): HarmonizeResult {
  const parsed = RawResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HarmonizationValidationError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }

  const header = parseAbcHeader(sourceAbc);
  const result: HarmonizeResult = {
    detectedKey: parsed.data.detectedKey?.trim() || metadata.key || header.key,
    detectedScale: parsed.data.detectedScale?.trim() || metadata.scale,
    timeSignature: parsed.data.timeSignature?.trim() || metadata.timeSignature || header.timeSignature,
    options: parsed.data.options.map(normalizeOption),
  };

  validateHarmonizationOptions(result, sourceAbc, metadata);
  return result;
}

export function validateHarmonizationOptions(result: HarmonizeResult, sourceAbc: string, metadata: HarmonizeMetadata): void {
  const issues: string[] = [];

  if (!Array.isArray(result.options) || result.options.length !== 5) {
    issues.push("expected exactly 5 harmonization options");
  }

  const ids = new Set<string>();
  const styles = new Set<string>();
  const progressionKeys = new Set<string>();

  for (const style of HARMONIZATION_CANDIDATE_STYLES) {
    const count = result.options.filter((option) => option.style === style || option.id === style).length;
    if (count !== 1) issues.push(`expected exactly one ${style} option`);
  }

  result.options.forEach((option, index) => {
    const prefix = `option ${index + 1}`;

    if (!option.id.trim()) issues.push(`${prefix} is missing id`);
    if (ids.has(option.id)) issues.push(`${prefix} duplicates id ${option.id}`);
    ids.add(option.id);

    if (!option.label.trim()) issues.push(`${prefix} is missing label`);
    if (!option.style.trim()) issues.push(`${prefix} is missing style`);
    styles.add(option.style);

    if (!option.explanation.trim()) issues.push(`${prefix} is missing explanation`);
    if (!option.harmonizedAbc.trim()) issues.push(`${prefix} is missing harmonizedAbc`);

    if (!Number.isFinite(option.confidence) || option.confidence < 0 || option.confidence > 1) {
      issues.push(`${prefix} confidence must be between 0 and 1`);
    }

    if (option.progression.length === 0) issues.push(`${prefix} is missing progression`);
    if (option.romanNumerals.length === 0) issues.push(`${prefix} is missing roman numerals`);
    if (option.progression.length !== option.romanNumerals.length) {
      issues.push(`${prefix} progression and romanNumerals must have matching lengths`);
    }

    const progressionKey = normalizeProgressionKey(option.progression);
    if (progressionKey && progressionKeys.has(progressionKey)) {
      issues.push(`${prefix} duplicates another candidate progression`);
    }
    progressionKeys.add(progressionKey);

    const chordsByMeasure = extractChordSymbolsByMeasure(option.harmonizedAbc);
    if (chordsByMeasure.length === 0) issues.push(`${prefix} contains no inline chord symbols`);

    issues.push(...validateAbcParseability(option.harmonizedAbc).map((issue) => `${prefix}: ${issue}`));
    issues.push(...validateMelodyPreserved(sourceAbc, option.harmonizedAbc).map((issue) => `${prefix}: ${issue}`));
    issues.push(...validateNoNewAccompaniment(sourceAbc, option.harmonizedAbc).map((issue) => `${prefix}: ${issue}`));

    const strongBeatWarnings = validateStrongBeatSupport(option, sourceAbc, metadata);
    const severeStrongBeatFailure = strongBeatWarnings.some((warning) => warning.startsWith("no strong-beat") || warning.includes("no chord symbols"));
    if (severeStrongBeatFailure) {
      issues.push(`${prefix}: ${strongBeatWarnings[0]}`);
    } else {
      option.warnings = Array.from(new Set([...option.warnings, ...strongBeatWarnings]));
      if (strongBeatWarnings.length === 0) {
        option.validationNotes = Array.from(new Set([...option.validationNotes, "Strong-beat melody notes are supported by candidate chord tones."]));
      }
    }

    option.progression_name = option.label;
    option.abc = option.harmonizedAbc;
  });

  if (styles.size !== result.options.length) {
    issues.push("candidate styles must be distinct");
  }

  if (issues.length > 0) {
    throw new HarmonizationValidationError(issues);
  }
}
