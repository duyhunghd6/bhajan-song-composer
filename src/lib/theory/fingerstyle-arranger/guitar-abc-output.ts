import { buildAbcDurationContext } from "../abc-duration";
import { getKeyAccidentalsFromAbc } from "../abc-key-signature";
import { convertTimeSliceMeasureToAbc, groupMeasuresByLine, joinMeasureAbcWithBarlines, type TimeSliceMeasure } from "./time-slice";

const GENERATED_HEADER_FIELDS = new Set(["X", "T", "L", "M", "Q", "K"]);

export function buildGeneratedGuitarAbc(measures: TimeSliceMeasure[], sourceAbc: string): string {
  const durationContext = buildAbcDurationContext(sourceAbc);
  const keyAccidentals = getKeyAccidentalsFromAbc(sourceAbc);
  const guitarLines = groupMeasuresByLine(measures).map(lineMeasures => (
    joinMeasureAbcWithBarlines(
      lineMeasures.map(measure => convertTimeSliceMeasureToAbc(measure, durationContext, keyAccidentals, true)),
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
