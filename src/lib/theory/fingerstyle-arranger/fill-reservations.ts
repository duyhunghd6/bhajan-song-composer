import {
  allowsMelodySustainFill,
  buildFillSelectionBudget,
  normalizeFillPolicy,
} from "./fill-opportunities";
import type { SkillLevel } from "./fingerstyle-constraints";
import type { TimeSliceMeasure } from "./time-slice";

export interface FillReservationSlot {
  id: string;
  measure: number;
  lineIndex: number;
  step: number;
  chord: string;
  melodyState: "sustain" | "rest";
  weight: "⬤" | "●" | "*" | null;
  score: number;
}

export interface FillReservationAnalysis {
  reservationSetId: string;
  sourceFingerprint: string;
  slots: FillReservationSlot[];
  maxSelections: number;
}

export interface FillReservationDecision {
  slotId: string;
  decision: "use" | "skip";
  reason: string;
}

export interface FillReservationSelection {
  reservationSetId: string;
  sourceFingerprint: string;
  decisions: FillReservationDecision[];
}

function stableId(sourceFingerprint: string, skillLevel: SkillLevel, densityMode: string, slots: FillReservationSlot[]): string {
  const body = slots.map(slot => `${slot.measure}:${slot.step}:${slot.chord}:${slot.melodyState}`).join("|");
  let hash = 5381;
  for (const char of `${sourceFingerprint}|${skillLevel}|${densityMode}|${body}`) hash = (hash * 33) ^ char.charCodeAt(0);
  return `frs-${(hash >>> 0).toString(36)}`;
}

export function analyzeFillReservationSlots(input: {
  measures: TimeSliceMeasure[];
  sourceFingerprint: string;
  skillLevel: SkillLevel;
  densityMode: string;
}): FillReservationAnalysis {
  const policy = normalizeFillPolicy({ skillLevel: input.skillLevel, densityMode: input.densityMode });
  const slots: FillReservationSlot[] = [];
  for (const measure of input.measures) {
    if (measure.pickupDurationUnits) continue;
    for (const step of measure.grid) {
      if (step.melody.state === "attack") continue;
      if (step.melody.state === "sustain" && !allowsMelodySustainFill(policy)) continue;
      const melodyState = step.melody.state;
      const score = (melodyState === "rest" ? 60 : 45) + (step.weight === null ? 20 : 5);
      slots.push({
        id: `fr-m${measure.measure}-s${step.step}`,
        measure: measure.measure,
        lineIndex: measure.lineIndex,
        step: step.step,
        chord: step.chord,
        melodyState,
        weight: step.weight,
        score,
      });
    }
  }
  const maxSelections = buildFillSelectionBudget(input.measures, policy).maxWindows;
  return {
    reservationSetId: stableId(input.sourceFingerprint, input.skillLevel, input.densityMode, slots),
    sourceFingerprint: input.sourceFingerprint,
    slots,
    maxSelections,
  };
}

export function formatFillReservationSlots(analysis: FillReservationAnalysis): string {
  return [
    "fill-reservation-slots:v1",
    `set,${analysis.reservationSetId}`,
    `source,${analysis.sourceFingerprint}`,
    `budget,${analysis.maxSelections}`,
    "rows: [R,id,measure,step,chord,melodyState,weight,score]",
    ...analysis.slots.map(slot => `R,${slot.id},${slot.measure},${slot.step},${slot.chord},${slot.melodyState},${slot.weight ?? "off"},${slot.score}`),
  ].join("\n");
}

export function parseFillReservationSelection(value: string): { valid: boolean; value?: FillReservationSelection; errors: string[] } {
  const lines = value.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const errors: string[] = [];
  if (lines.shift() !== "fill-reservations:v1") errors.push("Expected fill-reservations:v1 header.");
  const set = lines.shift()?.split(",");
  const source = lines.shift()?.split(",");
  if (set?.[0] !== "set" || !set[1]) errors.push("Missing reservation set binding.");
  if (source?.[0] !== "source" || !source[1]) errors.push("Missing source binding.");
  const decisions = lines.flatMap((line, index) => {
    if (line.startsWith("decisions:")) return [];
    const [tag, slotId, decision, ...reason] = line.split(",");
    if (tag !== "D" || !slotId || (decision !== "use" && decision !== "skip") || !reason.join(",").trim()) {
      errors.push(`Invalid reservation decision row ${index + 1}.`);
      return [];
    }
    return [{ slotId, decision, reason: reason.join(",").trim() } as FillReservationDecision];
  });
  return errors.length > 0 || !set?.[1] || !source?.[1]
    ? { valid: false, errors }
    : { valid: true, value: { reservationSetId: set[1], sourceFingerprint: source[1], decisions }, errors: [] };
}

export function validateFillReservationSelection(
  analysis: FillReservationAnalysis,
  selection: FillReservationSelection,
): { valid: boolean; errors: string[]; selectedSlotIds: string[] } {
  const errors: string[] = [];
  if (selection.reservationSetId !== analysis.reservationSetId) errors.push("Reservation set is stale or does not match the current source grid.");
  if (selection.sourceFingerprint !== analysis.sourceFingerprint) errors.push("Reservation source fingerprint does not match.");
  const expected = new Set(analysis.slots.map(slot => slot.id));
  const seen = new Set<string>();
  for (const decision of selection.decisions) {
    if (!expected.has(decision.slotId)) errors.push(`Unknown reservation slot ${decision.slotId}.`);
    if (seen.has(decision.slotId)) errors.push(`Duplicate reservation slot ${decision.slotId}.`);
    seen.add(decision.slotId);
  }
  for (const id of expected) if (!seen.has(id)) errors.push(`Missing reservation decision for ${id}.`);
  const selectedSlotIds = selection.decisions.filter(decision => decision.decision === "use").map(decision => decision.slotId);
  if (selectedSlotIds.length > analysis.maxSelections) errors.push(`Selected ${selectedSlotIds.length} fill reservations but policy allows ${analysis.maxSelections}.`);
  return { valid: errors.length === 0, errors, selectedSlotIds };
}
