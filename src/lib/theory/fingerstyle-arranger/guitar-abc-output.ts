import { buildAbcDurationContext, joinAbcMeasuresWithBarlines, cleanAbcMeasureSegment, EMPTY_BARLINE_INFO } from "../abc-duration";
import { getKeyAccidentalsFromAbc } from "../abc-key-signature";
import { processGuitarLine } from "../guitar-string-forcing";
import { groupMeasuresByLine, joinMeasureAbcWithBarlines, type TimeSliceMeasure } from "./time-slice";
import { renderTimeSliceMeasuresToAbc } from "./time-slice-abc-renderer";

const GENERATED_HEADER_FIELDS = new Set(["X", "T", "L", "M", "Q", "K"]);

export function buildGeneratedGuitarAbc(measures: TimeSliceMeasure[], sourceAbc: string): string {
  const durationContext = buildAbcDurationContext(sourceAbc);
  const keyAccidentals = getKeyAccidentalsFromAbc(sourceAbc);
  // Render the complete ordered sequence first so an explicit tie or slur may
  // close in the first measure of the next visual source line.
  const renderedMeasures = renderTimeSliceMeasuresToAbc(
    measures,
    durationContext,
    keyAccidentals,
    true,
  );
  const renderedByMeasure = new Map(measures.map((measure, index) => [measure, renderedMeasures[index]]));
  const guitarLines = groupMeasuresByLine(measures).map(lineMeasures => (
    joinMeasureAbcWithBarlines(
      lineMeasures.map(measure => renderedByMeasure.get(measure) ?? ""),
      lineMeasures,
    )
  ));
  return [
    'V:Guitar clef=treble-8 name="Fingerstyle Tablature"',
    "%%MIDI program 24",
    ...guitarLines,
  ].join("\n");
}

/** A self-contained, playable projection of the canonical TimeGrid. */
export function buildStandaloneGeneratedGuitarAbc(measures: TimeSliceMeasure[], sourceAbc: string): string {
  const sourceHeaders = sourceAbc
    .split(/\r?\n/)
    .filter(line => GENERATED_HEADER_FIELDS.has(line.trim()[0] ?? ""));
  return [
    ...sourceHeaders,
    "%%score (Guitar)",
    buildGeneratedGuitarAbc(measures, sourceAbc),
  ].join("\n");
}

/* ── Faithful Guitar reconstruction from preserved source ABC ── */

/**
 * Reconstruct a Guitar voice from the TimeGrid's preserved `source_abc.melody`.
 *
 * Unlike `convertTimeSliceMeasureToAbc` (which renders from grid tablature events
 * and loses ties, slurs, and rhythmic groupings), this takes the original measure
 * ABC text stored in `source_abc.melody` and applies `!N!` guitar string-forcing
 * decorations to each note token.
 *
 * `cleanAbcMeasureSegment` strips structural markers (volta brackets `[1,2`,
 * repeat colons `:`) that the raw `|`-split stores in the text — these are
 * reconstructed by `joinAbcMeasuresWithBarlines` from barline metadata instead.
 *
 * This preserves 100% of original ABC characteristics:
 * - Ties (`-`) including cross-measure ties like `B4-` → `B4`
 * - Slurs (`()`) including cross-measure slurs
 * - Chord symbols (`"Em"`, `"Am"`)
 * - Duration suffixes (`E2`, `E3`, `z/2`)
 * - Fermata (`!fermata!`), Segno (`S`)
 * - All other ABC decorations and annotations
 */
export function buildReconstructedGuitarAbc(measures: TimeSliceMeasure[], sourceAbc: string): string {
  const keyAccidentals = getKeyAccidentalsFromAbc(sourceAbc);

  const guitarLines = groupMeasuresByLine(measures).map(lineMeasures => {
    const forcedMeasures = lineMeasures.map(m => {
      // Clean structural markers (volta, repeat colons) — they'll be added back
      // by joinAbcMeasuresWithBarlines from barline metadata.
      // This preserves ties (-), slurs (()), chord symbols, durations, etc.
      const melodyText = cleanAbcMeasureSegment(m.source_abc?.melody ?? "");
      return processGuitarLine(melodyText, keyAccidentals);
    });
    return joinAbcMeasuresWithBarlines(
      forcedMeasures,
      lineMeasures.map(m => m.barline ?? EMPTY_BARLINE_INFO),
    );
  });

  return [
    'V:Guitar clef=treble-8 name="Guitar (Reconstructed)" snm="Gtr"',
    "%%MIDI program 24",
    ...guitarLines,
  ].join("\n");
}

/* ── Source melody extraction ── */

/**
 * Extract the original source melody body lines from the raw ABC notation,
 * including lyrics (`w:` lines), comments, and all ABC characteristics
 * (slurs, ties, repeats, volta, fermata, segno, chord symbols, etc.).
 * This preserves the source 100% verbatim.
 */
function extractSourceMelodyBody(sourceAbc: string): string[] {
  const lines = sourceAbc.split(/\r?\n/);
  const bodyLines: string[] = [];
  let inMelodyVoice = true;
  let pastHeaders = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines but pass them through after headers for formatting
    if (!trimmed) {
      if (pastHeaders) bodyLines.push("");
      continue;
    }

    // Skip header fields (X:, T:, L:, M:, Q:, K:, %%score)
    if (/^[XTLMQK]:/.test(trimmed) || trimmed.startsWith("%%score")) continue;

    // Voice declarations
    if (/^V:\s*Melody\b/.test(trimmed)) {
      inMelodyVoice = true;
      continue;
    }
    if (/^V:\s*\w/.test(trimmed) && !/^V:\s*Melody\b/.test(trimmed)) {
      inMelodyVoice = false;
      continue;
    }

    // Inline voice tags
    if (/^\[V:Melody\]/.test(trimmed)) {
      pastHeaders = true;
      bodyLines.push(trimmed.replace(/^\[V:Melody\]\s*/, ""));
      continue;
    }
    if (/^\[V:\w/.test(trimmed) && !/^\[V:Melody\]/.test(trimmed)) {
      continue;
    }

    // MIDI program directives for melody voice
    if (trimmed.startsWith("%%MIDI")) {
      if (inMelodyVoice) continue; // We'll re-emit this ourselves
      continue;
    }

    // Comments (% lines) — preserve them for the melody voice
    if (trimmed.startsWith("%")) {
      if (inMelodyVoice) bodyLines.push(trimmed);
      continue;
    }

    // Music body and lyric lines
    if (inMelodyVoice) {
      pastHeaders = true;
      bodyLines.push(line); // Use original line (not trimmed) to preserve indentation
    }
  }

  // Remove trailing empty lines
  while (bodyLines.length > 0 && !bodyLines[bodyLines.length - 1].trim()) {
    bodyLines.pop();
  }

  return bodyLines;
}

/* ── Comparison multi-voice ABC ── */

/**
 * Build a combined multi-voice ABC with:
 * - [V:Melody]: the original source melody, preserved 100% verbatim
 * - [V:Guitar]: faithful reconstruction from source_abc.melody with `!N!` string-forcing
 *
 * The Guitar voice preserves ALL original ABC characteristics (ties, slurs,
 * repeats, volta, chord symbols, lyrics, fermata, segno) because it transforms
 * the preserved source text rather than re-synthesizing from the lossy grid state.
 *
 * This renders as 2 staff lines in ABCJS for visual comparison:
 * staff 1 = original melody, staff 2 = reconstructed guitar + TAB.
 */
export function buildComparisonAbc(measures: TimeSliceMeasure[], sourceAbc: string): string {
  const sourceHeaders = sourceAbc
    .split(/\r?\n/)
    .filter(line => GENERATED_HEADER_FIELDS.has(line.trim()[0] ?? ""));

  const melodyBodyLines = extractSourceMelodyBody(sourceAbc);
  const guitarVoice = buildReconstructedGuitarAbc(measures, sourceAbc);

  return [
    ...sourceHeaders,
    '%%score (Melody) (Guitar)',
    'V:Melody treble nm="Melody (Original)" snm="Orig"',
    "%%MIDI program 53",
    ...melodyBodyLines,
    guitarVoice,
  ].join("\n");
}

