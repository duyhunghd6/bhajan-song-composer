import type { TimeSliceMeasure } from "../time-slice";
import type {
  FillAtomicCandidate,
  FillComposition,
  FillCompositionEntry,
  FillOpportunityAnalysis,
  FillSelection,
  FillValidationIssue,
  FillValidationResult,
} from "./types";

export interface FillSelectionValidationResult {
  valid: boolean;
  errors: string[];
  selectedWindowIds: string[];
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function validateBindings(
  analysis: FillOpportunityAnalysis,
  value: { opportunitySetId: string; sourceFingerprint: string },
): string[] {
  const errors: string[] = [];
  if (value.opportunitySetId !== analysis.opportunitySetId) {
    errors.push("Opportunity set is stale or belongs to another analysis run.");
  }
  if (value.sourceFingerprint !== analysis.sourceFingerprint) {
    errors.push("Source fingerprint does not match the frozen foundation.");
  }
  return errors;
}

export function validateFillSelection(
  analysis: FillOpportunityAnalysis,
  selection: FillSelection,
): FillSelectionValidationResult {
  const errors = validateBindings(analysis, selection);
  const windowById = new Map(analysis.windows.map(window => [window.id, window]));
  const decisionIds = selection.decisions.map(decision => decision.windowId);
  const duplicateIds = duplicateValues(decisionIds);
  if (duplicateIds.length > 0) errors.push(`Duplicate window decisions: ${duplicateIds.join(", ")}.`);

  const unknownIds = [...new Set(decisionIds.filter(id => !windowById.has(id)))];
  if (unknownIds.length > 0) errors.push(`Unknown window IDs: ${unknownIds.join(", ")}.`);
  const omittedIds = analysis.windows.map(window => window.id).filter(id => !decisionIds.includes(id));
  if (omittedIds.length > 0) errors.push(`Every scored window needs use/skip decision; omitted: ${omittedIds.join(", ")}.`);

  const selectedWindowIds = selection.decisions
    .filter(decision => decision.decision === "use" && windowById.has(decision.windowId))
    .map(decision => decision.windowId);
  if (selectedWindowIds.length > analysis.budget.maxWindows) {
    errors.push(`Selected ${selectedWindowIds.length} windows; maximum is ${analysis.budget.maxWindows}.`);
  }
  if (analysis.policy.resolvedDensity === "off" && selectedWindowIds.length > 0) {
    errors.push("Fill density is off; all windows must be skipped.");
  }

  const selectedByMeasure = new Map<number, number>();
  for (const windowId of selectedWindowIds) {
    const measure = windowById.get(windowId)?.measure;
    if (measure === undefined) continue;
    selectedByMeasure.set(measure, (selectedByMeasure.get(measure) ?? 0) + 1);
  }
  for (const [measure, count] of selectedByMeasure) {
    if (count > analysis.budget.maxWindowsPerMeasure) {
      errors.push(`Measure ${measure} selects ${count} windows; maximum is ${analysis.budget.maxWindowsPerMeasure}.`);
    }
  }

  return { valid: errors.length === 0, errors, selectedWindowIds };
}

interface ResolvedEntry {
  candidate: FillAtomicCandidate;
  entry: FillCompositionEntry;
}

function candidateIntervalsOverlap(left: ResolvedEntry, right: ResolvedEntry): boolean {
  if (left.candidate.measure !== right.candidate.measure || left.candidate.string !== right.candidate.string) return false;
  const leftEnd = left.candidate.step + left.entry.durationSteps;
  const rightEnd = right.candidate.step + right.entry.durationSteps;
  return left.candidate.step < rightEnd && right.candidate.step < leftEnd;
}

function validatesApproachResolution(entry: ResolvedEntry, entries: ResolvedEntry[]): boolean {
  if (entry.candidate.harmonicRole !== "scale-approach") return true;
  return entries.some(next => (
    next.candidate.windowId === entry.candidate.windowId
    && next.candidate.step >= entry.candidate.step + entry.entry.durationSteps
    && next.candidate.harmonicRole !== "scale-approach"
    && Math.abs(next.candidate.midi - entry.candidate.midi) <= 2
  ));
}

function validationIssue(code: string, message: string): FillValidationIssue {
  return { code, message };
}

export function validateFillComposition(
  analysis: FillOpportunityAnalysis,
  selection: FillSelection,
  composition: FillComposition,
): FillValidationResult<FillCompositionEntry[]> {
  const selectionResult = validateFillSelection(analysis, selection);
  const errors = [...selectionResult.errors, ...validateBindings(analysis, composition)];
  const selectedIds = new Set(selectionResult.selectedWindowIds);
  const windowById = new Map(analysis.windows.map(window => [window.id, window]));
  const candidateById = new Map(analysis.candidates.map(candidate => [candidate.id, candidate]));
  const duplicateCandidateIds = duplicateValues(composition.entries.map(entry => entry.candidateId));
  if (duplicateCandidateIds.length > 0) {
    errors.push(`Candidate IDs may be used only once: ${duplicateCandidateIds.join(", ")}.`);
  }

  const resolvedEntries: ResolvedEntry[] = [];
  const notesByWindow = new Map<string, number>();
  for (const entry of composition.entries) {
    const candidate = candidateById.get(entry.candidateId);
    if (!candidate) {
      errors.push(`Unknown fill candidate ${entry.candidateId}.`);
      continue;
    }
    const window = windowById.get(candidate.windowId);
    if (!window) {
      errors.push(`Candidate ${entry.candidateId} references unknown window ${candidate.windowId}.`);
      continue;
    }
    if (!selectedIds.has(candidate.windowId)) {
      errors.push(`Window ${candidate.windowId} was not selected for use.`);
    }
    if (!Number.isSafeInteger(entry.durationSteps) || entry.durationSteps < 1) {
      errors.push(`Candidate ${entry.candidateId} has invalid duration ${entry.durationSteps}.`);
      continue;
    }
    if (entry.durationSteps > candidate.maxDurationSteps) {
      errors.push(`Candidate ${entry.candidateId} duration ${entry.durationSteps} exceeds capacity ${candidate.maxDurationSteps}.`);
      continue;
    }
    if (candidate.step + entry.durationSteps - 1 > window.endStep) {
      errors.push(`Candidate ${entry.candidateId} sounds beyond window ${window.id}.`);
      continue;
    }
    notesByWindow.set(candidate.windowId, (notesByWindow.get(candidate.windowId) ?? 0) + 1);
    resolvedEntries.push({ candidate, entry });
  }

  for (const windowId of selectedIds) {
    const count = notesByWindow.get(windowId) ?? 0;
    if (count === 0) errors.push(`Selected window ${windowId} needs at least one composed note.`);
    if (count > analysis.budget.maxNotesPerWindow) {
      errors.push(`Window ${windowId} has ${count} notes; maximum is ${analysis.budget.maxNotesPerWindow}.`);
    }
  }

  for (let leftIndex = 0; leftIndex < resolvedEntries.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < resolvedEntries.length; rightIndex++) {
      if (candidateIntervalsOverlap(resolvedEntries[leftIndex], resolvedEntries[rightIndex])) {
        errors.push(`Candidates ${resolvedEntries[leftIndex].candidate.id} and ${resolvedEntries[rightIndex].candidate.id} overlap on one string.`);
      }
    }
  }
  for (const entry of resolvedEntries) {
    if (!validatesApproachResolution(entry, resolvedEntries)) {
      errors.push(`Scale approach ${entry.candidate.id} must resolve by step to a chord tone in the same window.`);
    }
  }

  resolvedEntries.sort((left, right) => (
    left.candidate.measure - right.candidate.measure
    || left.candidate.step - right.candidate.step
    || left.candidate.string - right.candidate.string
    || left.candidate.id.localeCompare(right.candidate.id)
  ));
  const issues = [...new Set(errors)].map(message => validationIssue("invalid-fill-composition", message));
  return {
    valid: issues.length === 0,
    value: issues.length === 0 ? resolvedEntries.map(entry => entry.entry) : undefined,
    issues,
    message: issues.length === 0 ? "Fill composition is valid." : issues.map(issue => issue.message).join(" "),
  };
}

export function mergeAcceptedFills(
  measures: TimeSliceMeasure[],
  analysis: FillOpportunityAnalysis,
  validation: FillValidationResult<FillCompositionEntry[]>,
): TimeSliceMeasure[] {
  if (!validation.valid || !validation.value) throw new Error(`Cannot merge invalid fills: ${validation.message}`);
  const candidateById = new Map(analysis.candidates.map(candidate => [candidate.id, candidate]));
  const merged = structuredClone(measures);
  const measureByNumber = new Map(merged.map(measure => [measure.measure, measure]));

  for (const entry of validation.value) {
    const candidate = candidateById.get(entry.candidateId);
    if (!candidate) throw new Error(`Accepted candidate ${entry.candidateId} is unavailable.`);
    const measure = measureByNumber.get(candidate.measure);
    const step = measure?.grid.find(gridStep => gridStep.step === candidate.step);
    if (!measure || !step) throw new Error(`Accepted candidate ${candidate.id} points outside the frozen grid.`);
    step.tablature = [
      ...(step.tablature ?? []),
      {
        string: candidate.string,
        fret: candidate.fret,
        finger: entry.finger,
        role: "fill",
        durationSteps: entry.durationSteps,
        fillWindowId: candidate.windowId,
        fillCandidateId: entry.candidateId,
      },
    ];
    step.tablature.sort((left, right) => left.string - right.string || left.fret - right.fret);
  }

  return merged;
}
