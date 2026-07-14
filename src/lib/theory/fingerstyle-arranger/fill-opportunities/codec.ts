import {
  FILL_COMPOSITION_FORMAT_VERSION,
  FILL_OPPORTUNITY_FORMAT_VERSION,
  FILL_SELECTION_FORMAT_VERSION,
  type FillComposition,
  type FillCompositionEntry,
  type FillOpportunityAnalysis,
  type FillOpportunityPage,
  type FillSelection,
  type FillSelectionDecision,
} from "./types";

const DEFAULT_PAGE_BYTES = 24_000;
const DEFAULT_PAGE_ROWS = 180;
const MAX_INPUT_BYTES = 32_000;
const MAX_INPUT_ROWS = 512;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export interface FillCodecParseResult<T> {
  valid: boolean;
  value?: T;
  errors: string[];
}

export interface FillOpportunityPageOptions {
  cursor?: number | null;
  maxBytes?: number;
  maxRows?: number;
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(",");
}

function parseCsvRow(line: string): string[] | null {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) return null;
  cells.push(cell.trim());
  return cells;
}

function windowRow(analysis: FillOpportunityAnalysis, index: number): string {
  const window = analysis.windows[index];
  const breakdown = window.scoreBreakdown;
  return csvRow([
    "W",
    window.id,
    window.measure,
    window.lineIndex,
    window.startStep,
    window.endStep,
    window.capacitySteps,
    window.activeChord,
    window.key,
    window.melodyContext,
    window.score,
    `${breakdown.silenceCapacity}/${breakdown.phraseTransfer}/${breakdown.handContinuity}/${breakdown.harmonicFit}/${breakdown.voiceLeading}/${breakdown.metricFit}`,
    `${breakdown.cadenceRestraint}/${breakdown.crowdingPenalty}/${breakdown.repetitionPenalty}`,
    window.protectedStrings.join("|"),
    window.flags.join("|"),
    window.candidateIds.length,
    window.boundaryEvidence.lineEnd ? 1 : 0,
    window.boundaryEvidence.trailingRestSteps,
    window.boundaryEvidence.lyricTerminal ? 1 : 0,
    window.boundaryEvidence.repeatBoundary ? 1 : 0,
    window.boundaryEvidence.cadenceHint,
    window.boundaryEvidence.nextMelodyDistanceSteps,
    window.boundaryEvidence.confidence,
  ]);
}

function candidateRow(analysis: FillOpportunityAnalysis, index: number): string {
  const candidate = analysis.candidates[index];
  return csvRow([
    "C",
    candidate.id,
    candidate.windowId,
    candidate.measure,
    candidate.step,
    candidate.pitch,
    candidate.midi,
    candidate.harmonicRole,
    candidate.string,
    candidate.fret,
    candidate.suggestedFinger,
    candidate.maxDurationSteps,
    candidate.incomingHandCost,
    candidate.outgoingHandCost,
    candidate.totalHandCost,
    candidate.score,
    candidate.conditions.join("|"),
  ]);
}

function opportunityRecords(analysis: FillOpportunityAnalysis): string[] {
  return [
    ...analysis.windows.map((_, index) => windowRow(analysis, index)),
    ...analysis.candidates.map((_, index) => candidateRow(analysis, index)),
  ];
}

function pageHeader(
  analysis: FillOpportunityAnalysis,
  cursor: number,
  nextCursor: number | null,
  candidateCount: number,
): string[] {
  const budget = analysis.budget;
  return [
    FILL_OPPORTUNITY_FORMAT_VERSION,
    csvRow(["set", analysis.opportunitySetId]),
    csvRow(["source", analysis.sourceFingerprint]),
    csvRow(["policy", analysis.policy.skillLevel, analysis.policy.densityMode, analysis.policy.resolvedDensity, analysis.policy.densitySource]),
    csvRow(["budget", budget.targetWindows, budget.maxWindows, budget.maxWindowsPerMeasure, budget.maxNotesPerWindow]),
    csvRow(["counts", analysis.evaluatedStepCount, analysis.evaluatedPlacementCount, analysis.windows.length, analysis.candidates.length]),
    csvRow(["page", cursor, nextCursor ?? "end", candidateCount, nextCursor === null ? 0 : 1]),
    "rows: [kind,...]",
    "W,id,measure,line,start,end,capacity,chord,key,context,score,positiveBreakdown,penalties,protectedStrings,flags,candidateCount,lineEnd,trailingRest,lyricTerminal,repeatBoundary,cadence,nextMelodyDistance,confidence",
    "C,id,window,measure,step,pitch,midi,role,string,fret,finger,maxDuration,inCost,outCost,totalCost,score,conditions",
  ];
}

export function paginateFillOpportunities(
  analysis: FillOpportunityAnalysis,
  options: FillOpportunityPageOptions = {},
): FillOpportunityPage {
  const records = opportunityRecords(analysis);
  const offset = options.cursor ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > records.length) {
    throw new Error("Invalid fill-opportunity cursor.");
  }
  const maxRows = Math.max(1, Math.min(options.maxRows ?? DEFAULT_PAGE_ROWS, DEFAULT_PAGE_ROWS));
  const maxBytes = Math.max(2_000, Math.min(options.maxBytes ?? DEFAULT_PAGE_BYTES, DEFAULT_PAGE_BYTES));
  const selected: string[] = [];
  let nextOffset = offset;

  while (nextOffset < records.length && selected.length < maxRows) {
    const candidateRows = [...selected, records[nextOffset]];
    const provisionalNext = nextOffset + 1 < records.length ? nextOffset + 1 : null;
    const encoded = [
      ...pageHeader(analysis, offset, provisionalNext, candidateRows.length),
      ...candidateRows,
    ].join("\n");
    if (utf8ByteLength(encoded) > maxBytes) {
      if (selected.length === 0) throw new Error("A single fill-opportunity row exceeds the page byte limit.");
      break;
    }
    selected.push(records[nextOffset]);
    nextOffset++;
  }

  const nextCursor = nextOffset < records.length ? nextOffset : null;
  const candidateCount = selected.filter(row => row.startsWith("C,")).length;
  return {
    cursor: offset,
    nextCursor,
    candidateCount,
    toon: [...pageHeader(analysis, offset, nextCursor, candidateCount), ...selected].join("\n"),
  };
}

function normalizedInputLines(input: string, expectedVersion: string): FillCodecParseResult<string[]> {
  const errors: string[] = [];
  if (utf8ByteLength(input) > MAX_INPUT_BYTES) errors.push(`Payload exceeds ${MAX_INPUT_BYTES} bytes.`);
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > MAX_INPUT_ROWS) errors.push(`Payload exceeds ${MAX_INPUT_ROWS} rows.`);
  if (lines[0] !== expectedVersion) errors.push(`Expected version ${expectedVersion}.`);
  return errors.length > 0 ? { valid: false, errors } : { valid: true, value: lines, errors: [] };
}

function validateContractShape(
  lines: string[],
  header: string,
  rowPrefix: string,
  errors: string[],
): void {
  if (lines.length < 4) {
    errors.push("Payload is missing required binding or table header rows.");
    return;
  }
  if (!lines[1].startsWith("set,")) errors.push("The set binding must be the second row.");
  if (!lines[2].startsWith("source,")) errors.push("The source binding must be the third row.");
  if (lines[3] !== header) errors.push(`Expected exact table header: ${header}`);
  for (const line of lines.slice(4)) {
    if (!line.startsWith(`${rowPrefix},`)) errors.push(`Unexpected row in compact payload: ${line.slice(0, 120)}`);
  }
}

function parseBinding(lines: string[], name: string, errors: string[]): string | null {
  const matches = lines.filter(line => line.startsWith(`${name},`));
  if (matches.length !== 1) {
    errors.push(`Expected exactly one ${name} binding.`);
    return null;
  }
  const cells = parseCsvRow(matches[0]);
  if (!cells || cells.length !== 2 || !cells[1]) {
    errors.push(`Invalid ${name} binding.`);
    return null;
  }
  return cells[1];
}

export function parseFillSelectionToon(input: string): FillCodecParseResult<FillSelection> {
  const normalized = normalizedInputLines(input, FILL_SELECTION_FORMAT_VERSION);
  if (!normalized.valid || !normalized.value) return { valid: false, errors: normalized.errors };
  const errors: string[] = [];
  validateContractShape(normalized.value, "decisions: [D,window,use|skip,reason]", "D", errors);
  const opportunitySetId = parseBinding(normalized.value, "set", errors);
  const sourceFingerprint = parseBinding(normalized.value, "source", errors);
  const decisionLines = normalized.value.slice(4).filter(line => line.startsWith("D,"));
  const decisions: FillSelectionDecision[] = [];

  for (const line of decisionLines) {
    const cells = parseCsvRow(line);
    if (!cells || cells.length !== 4) {
      errors.push(`Invalid decision row: ${line.slice(0, 120)}`);
      continue;
    }
    if (cells[2] !== "use" && cells[2] !== "skip") {
      errors.push(`Decision for ${cells[1] || "unknown window"} must be use or skip.`);
      continue;
    }
    if (!cells[1] || !cells[3]) {
      errors.push("Decision rows require a window ID and non-empty reason.");
      continue;
    }
    decisions.push({ windowId: cells[1], decision: cells[2], reason: cells[3] });
  }
  if (!opportunitySetId || !sourceFingerprint || errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    value: {
      version: FILL_SELECTION_FORMAT_VERSION,
      opportunitySetId,
      sourceFingerprint,
      decisions,
    },
  };
}

export function parseFillCompositionToon(input: string): FillCodecParseResult<FillComposition> {
  const normalized = normalizedInputLines(input, FILL_COMPOSITION_FORMAT_VERSION);
  if (!normalized.valid || !normalized.value) return { valid: false, errors: normalized.errors };
  const errors: string[] = [];
  validateContractShape(normalized.value, "notes: [N,candidate,durationSteps,finger]", "N", errors);
  const opportunitySetId = parseBinding(normalized.value, "set", errors);
  const sourceFingerprint = parseBinding(normalized.value, "source", errors);
  const noteLines = normalized.value.slice(4).filter(line => line.startsWith("N,"));
  const entries: FillCompositionEntry[] = [];

  for (const line of noteLines) {
    const cells = parseCsvRow(line);
    if (!cells || cells.length !== 4) {
      errors.push(`Invalid fill note row: ${line.slice(0, 120)}`);
      continue;
    }
    const durationSteps = Number(cells[2]);
    if (!Number.isSafeInteger(durationSteps) || durationSteps < 1) {
      errors.push(`Duration for candidate ${cells[1] || "unknown"} must be a positive integer.`);
      continue;
    }
    if (cells[3] !== "i" && cells[3] !== "m" && cells[3] !== "a") {
      errors.push(`Finger for candidate ${cells[1] || "unknown"} must be i, m, or a.`);
      continue;
    }
    entries.push({ candidateId: cells[1], durationSteps, finger: cells[3] });
  }
  if (!opportunitySetId || !sourceFingerprint || errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    value: {
      version: FILL_COMPOSITION_FORMAT_VERSION,
      opportunitySetId,
      sourceFingerprint,
      entries,
    },
  };
}

export function encodeFillSelection(selection: FillSelection): string {
  return [
    selection.version,
    csvRow(["set", selection.opportunitySetId]),
    csvRow(["source", selection.sourceFingerprint]),
    "decisions: [D,window,use|skip,reason]",
    ...selection.decisions.map(decision => csvRow(["D", decision.windowId, decision.decision, decision.reason])),
  ].join("\n");
}

export function encodeFillComposition(composition: FillComposition): string {
  return [
    composition.version,
    csvRow(["set", composition.opportunitySetId]),
    csvRow(["source", composition.sourceFingerprint]),
    "notes: [N,candidate,durationSteps,finger]",
    ...composition.entries.map(entry => csvRow(["N", entry.candidateId, entry.durationSteps, entry.finger])),
  ].join("\n");
}
