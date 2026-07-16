import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";

export interface FingerstyleLineGenerationClaim {
  lineIndex: number;
  token: string;
  documentEpoch: number;
  lineRevision: number;
}

export interface FingerstyleLineGenerationCoordinator {
  activeLineIndexes(): number[];
  claim(lineIndex: number): FingerstyleLineGenerationClaim | null;
  release(claim: FingerstyleLineGenerationClaim): void;
  canApply(claim: FingerstyleLineGenerationClaim): boolean;
  markLineApplied(lineIndex: number): void;
  invalidateDocument(): void;
}

/** Tracks independent line jobs while rejecting stale document or same-line results. */
export function createFingerstyleLineGenerationCoordinator(): FingerstyleLineGenerationCoordinator {
  let documentEpoch = 0;
  let nextToken = 0;
  const inFlightByLine = new Map<number, FingerstyleLineGenerationClaim>();
  const revisionsByLine = new Map<number, number>();

  return {
    activeLineIndexes: () => [...inFlightByLine.keys()],
    claim: (lineIndex) => {
      if (inFlightByLine.has(lineIndex)) return null;
      const claim = {
        lineIndex,
        token: `${lineIndex}-${++nextToken}`,
        documentEpoch,
        lineRevision: revisionsByLine.get(lineIndex) ?? 0,
      };
      inFlightByLine.set(lineIndex, claim);
      return claim;
    },
    release: (claim) => {
      if (inFlightByLine.get(claim.lineIndex)?.token === claim.token) {
        inFlightByLine.delete(claim.lineIndex);
      }
    },
    canApply: (claim) => (
      documentEpoch === claim.documentEpoch
      && (revisionsByLine.get(claim.lineIndex) ?? 0) === claim.lineRevision
      && inFlightByLine.get(claim.lineIndex)?.token === claim.token
    ),
    markLineApplied: (lineIndex) => {
      revisionsByLine.set(lineIndex, (revisionsByLine.get(lineIndex) ?? 0) + 1);
    },
    invalidateDocument: () => {
      documentEpoch += 1;
      inFlightByLine.clear();
      revisionsByLine.clear();
    },
  };
}

function sourceStepMatches(current: TimeSliceMeasure["grid"][number], returned: TimeSliceMeasure["grid"][number]): boolean {
  return (
    current.step === returned.step
    && current.chord === returned.chord
    && current.weight === returned.weight
    && current.lyric === returned.lyric
    && current.melody.pitch === returned.melody.pitch
    && current.melody.state === returned.melody.state
  );
}

/**
 * Merges only validated generated tablature into the current canonical source grid.
 * Source timing, harmony, lyrics, and melody remain owned by the workspace document.
 */
export function mergeGeneratedFingerstyleLineMeasures(
  measures: TimeSliceMeasure[],
  lineIndex: number,
  updated: TimeSliceMeasure[],
): TimeSliceMeasure[] | null {
  const currentLine = measures.filter(measure => measure.lineIndex === lineIndex);
  if (currentLine.length === 0 || updated.length !== currentLine.length) return null;

  const updatedByMeasure = new Map(updated.map(measure => [measure.measure, measure]));
  if (updatedByMeasure.size !== updated.length) return null;

  for (const current of currentLine) {
    const returned = updatedByMeasure.get(current.measure);
    if (
      !returned
      || returned.lineIndex !== lineIndex
      || returned.grid.length !== current.grid.length
      || !returned.grid.every((step, index) => sourceStepMatches(current.grid[index], step))
    ) return null;
  }

  return measures.map(current => {
    const returned = updatedByMeasure.get(current.measure);
    if (!returned) return current;
    return {
      ...current,
      grid: current.grid.map((step, index) => ({
        ...step,
        melody: { ...step.melody },
        tablature: returned.grid[index].tablature?.map(tab => ({ ...tab })),
      })),
    };
  });
}

/** Replaces only measures returned by one line-level generation request. */
export function replaceGeneratedFingerstyleLineMeasures(
  measures: TimeSliceMeasure[],
  updated: TimeSliceMeasure[],
): TimeSliceMeasure[] {
  const lineIndex = updated[0]?.lineIndex;
  if (lineIndex === undefined) return measures;
  return mergeGeneratedFingerstyleLineMeasures(measures, lineIndex, updated) ?? measures;
}
