/**
 * A source-bound, instrument-specific realization chosen for a chord range.
 *
 * This module deliberately owns no rendering or instrument physics. Renderers
 * provide the candidate and validation report; this contract preserves the
 * user's decision and resolves its precedence without ever changing harmony.
 */

export type VoicingInstrument = "guitar-classic" | "piano";
export type VoicingOverrideScope = "chord-window" | "phrase" | "section";
export type VoicingOverrideStatus = "valid" | "review" | "stale";

export interface VoicingTimelinePoint {
  /** Zero-based measure index in the immutable harmony snapshot. */
  measureIndex: number;
  /** One-based beat within the measure. */
  beat: number;
  /** Optional zero-based subdivision within the beat. */
  subdivision?: number;
}

/** End is exclusive, matching the chord-window timing contract. */
export interface VoicingWindowRange {
  scope: VoicingOverrideScope;
  start: VoicingTimelinePoint;
  end: VoicingTimelinePoint;
  chordWindowId?: string;
  phraseId?: string;
  sectionId?: string;
}

/** The locked harmony identity, not a user-editable chord symbol. */
export interface VoicingChordIdentity {
  symbol: string;
  normalizedSymbol: string;
  chordWindowIds: string[];
}

export interface VoicingRegister {
  lowestMidi: number;
  highestMidi: number;
}

export interface VoicingConstraintCheck {
  valid: boolean;
  reasons: string[];
}

export interface VoicingCandidateValidation {
  chordIdentity: VoicingConstraintCheck;
  singerYield: VoicingConstraintCheck;
  physical: VoicingConstraintCheck;
}

interface VoicingCandidateBase {
  voicingId: string;
  chordIdentity: VoicingChordIdentity;
  spelledPitches: string[];
  register: VoicingRegister;
  transitionCost: number;
  validation: VoicingCandidateValidation;
}

export interface GuitarVoicingCandidate extends VoicingCandidateBase {
  instrument: "guitar-classic";
  shapeLabel: string;
  positionFret: number;
  frets: Array<number | "X">;
  strings: number[];
  barre?: { fret: number; fromString: number; toString: number };
  fingerCost: number;
  bassNote: string;
  capo: number;
}

export interface PianoVoicingCandidate extends VoicingCandidateBase {
  instrument: "piano";
  inversion: "root" | "first" | "second" | "third";
  leftHandPitches: string[];
  rightHandPitches: string[];
  spacingSemitones: number;
  leftHandSpanSemitones: number;
  rightHandSpanSemitones: number;
  bassTreatment: "root" | "octave" | "open-fifth" | "1-5-8";
}

export type VoicingCandidate = GuitarVoicingCandidate | PianoVoicingCandidate;

export interface VoicingOverrideValidationReport {
  evaluatedAt: string;
  candidateAvailable: boolean;
  chordIdentity: VoicingConstraintCheck;
  singerYield: VoicingConstraintCheck;
  physical: VoicingConstraintCheck;
  /** The arrival transition into the selected range. */
  leftEdgeTransition: VoicingConstraintCheck;
  /** The departure transition out of the selected range. */
  rightEdgeTransition: VoicingConstraintCheck;
  diagnostics: string[];
}

export interface VoicingOverride {
  id: string;
  instrument: VoicingInstrument;
  /** Defaults to exactly the selected strong beat's chord window. */
  windowRange: VoicingWindowRange;
  baseChordIdentity: VoicingChordIdentity;
  voicingId: string;
  sourceRevisionId: string;
  createdFromPlanRevisionId: string;
  createdAt: string;
  rationale?: string;
  softException?: string;
  validation: VoicingOverrideValidationReport;
  status: VoicingOverrideStatus;
  /** Records a later check without rewriting the revision that created it. */
  lastValidatedAgainstRevisionId?: string;
}

export interface VoicingDecisionLayer {
  voicingId: string;
  appliesTo?: VoicingWindowRange;
}

export interface LocalVoicingRealization {
  id: string;
  type: "accent" | "density" | "fill";
  appliesTo: VoicingWindowRange;
  /** A local event can intentionally replace the sounding voicing at its slot. */
  replacementVoicingId?: string;
}

export interface VoicingResolutionInput {
  instrument: VoicingInstrument;
  targetRange: VoicingWindowRange;
  /** Locked chord identity at the realization target. */
  targetChordIdentity: VoicingChordIdentity;
  snapshot: VoicingDecisionLayer;
  profilePlan?: VoicingDecisionLayer;
  voicingPlan?: VoicingDecisionLayer;
  overrides: readonly VoicingOverride[];
  localRealizations?: readonly LocalVoicingRealization[];
}

export interface VoicingResolution {
  voicingId: string;
  source: "snapshot" | "profile-plan" | "voicing-plan" | "override" | "local-realization";
  appliedOverride?: VoicingOverride;
  appliedLocalRealizations: LocalVoicingRealization[];
}

export interface RevalidateVoicingOverrideInput {
  override: VoicingOverride;
  currentSourceRevisionId: string;
  validation: VoicingOverrideValidationReport;
}

function comparePoint(left: VoicingTimelinePoint, right: VoicingTimelinePoint): number {
  if (left.measureIndex !== right.measureIndex) return left.measureIndex - right.measureIndex;
  if (left.beat !== right.beat) return left.beat - right.beat;
  return (left.subdivision ?? 0) - (right.subdivision ?? 0);
}

function rangeContains(container: VoicingWindowRange, target: VoicingWindowRange): boolean {
  return comparePoint(container.start, target.start) <= 0 && comparePoint(container.end, target.end) >= 0;
}

function rangeSpan(range: VoicingWindowRange): number {
  const pointValue = (point: VoicingTimelinePoint) =>
    point.measureIndex * 1_000_000 + point.beat * 1_000 + (point.subdivision ?? 0);
  return pointValue(range.end) - pointValue(range.start);
}

function scopeSpecificity(scope: VoicingOverrideScope): number {
  return scope === "chord-window" ? 0 : scope === "phrase" ? 1 : 2;
}

function layerApplies(layer: VoicingDecisionLayer, target: VoicingWindowRange): boolean {
  return !layer.appliesTo || rangeContains(layer.appliesTo, target);
}

function localRealizationApplies(realization: LocalVoicingRealization, target: VoicingWindowRange): boolean {
  return rangeContains(realization.appliesTo, target);
}

/**
 * The default inspector target. A UI may widen this only after an explicit
 * user choice, retaining the exact source chord-window identity.
 */
export function defaultVoicingOverrideRange(chordWindow: Omit<VoicingWindowRange, "scope">): VoicingWindowRange {
  return { ...chordWindow, scope: "chord-window" };
}

export function isCandidateCompatibleWithOverride(candidate: VoicingCandidate, override: VoicingOverride): boolean {
  return candidate.instrument === override.instrument
    && candidate.voicingId === override.voicingId
    && candidate.chordIdentity.normalizedSymbol === override.baseChordIdentity.normalizedSymbol
    && candidate.validation.chordIdentity.valid;
}

/**
 * Only validated overrides are rendered. Review/stale entries are retained by
 * the project and exposed to the user, instead of being silently rewritten.
 */
export function selectNarrowestApplicableOverride(
  overrides: readonly VoicingOverride[],
  instrument: VoicingInstrument,
  targetRange: VoicingWindowRange,
  targetChordIdentity: VoicingChordIdentity,
): VoicingOverride | undefined {
  return overrides
    .filter((override) => override.instrument === instrument)
    .filter((override) => override.status === "valid")
    .filter((override) => (
      override.baseChordIdentity.normalizedSymbol === targetChordIdentity.normalizedSymbol
      && override.baseChordIdentity.chordWindowIds.some((id) => targetChordIdentity.chordWindowIds.includes(id))
    ))
    .filter((override) => rangeContains(override.windowRange, targetRange))
    .slice()
    .sort((left, right) => (
      scopeSpecificity(left.windowRange.scope) - scopeSpecificity(right.windowRange.scope)
      || rangeSpan(left.windowRange) - rangeSpan(right.windowRange)
      || right.createdAt.localeCompare(left.createdAt)
      || left.id.localeCompare(right.id)
    ))[0];
}

/** Implements snapshot → profile → plan → narrowest override → local event precedence. */
export function resolveVoicing(input: VoicingResolutionInput): VoicingResolution {
  let voicingId = input.snapshot.voicingId;
  let source: VoicingResolution["source"] = "snapshot";

  if (input.profilePlan && layerApplies(input.profilePlan, input.targetRange)) {
    voicingId = input.profilePlan.voicingId;
    source = "profile-plan";
  }
  if (input.voicingPlan && layerApplies(input.voicingPlan, input.targetRange)) {
    voicingId = input.voicingPlan.voicingId;
    source = "voicing-plan";
  }

  const appliedOverride = selectNarrowestApplicableOverride(
    input.overrides,
    input.instrument,
    input.targetRange,
    input.targetChordIdentity,
  );
  if (appliedOverride) {
    voicingId = appliedOverride.voicingId;
    source = "override";
  }

  const appliedLocalRealizations = (input.localRealizations ?? [])
    .filter((realization) => localRealizationApplies(realization, input.targetRange));
  const replacingLocalRealization = appliedLocalRealizations.findLast((realization) => realization.replacementVoicingId);
  if (replacingLocalRealization?.replacementVoicingId) {
    voicingId = replacingLocalRealization.replacementVoicingId;
    source = "local-realization";
  }

  return { voicingId, source, appliedOverride, appliedLocalRealizations };
}

function isValidationCurrent(validation: VoicingOverrideValidationReport): boolean {
  return validation.candidateAvailable
    && validation.chordIdentity.valid
    && validation.singerYield.valid
    && validation.physical.valid
    && validation.leftEdgeTransition.valid
    && validation.rightEdgeTransition.valid;
}

/**
 * Preserve the selected voicing ID and original source revision on every
 * revalidation. A caller stores this as a new project revision; this function
 * never deletes or substitutes the user's selection.
 */
export function revalidateVoicingOverride(input: RevalidateVoicingOverrideInput): VoicingOverride {
  const sourceChanged = input.override.sourceRevisionId !== input.currentSourceRevisionId;
  const status: VoicingOverrideStatus = sourceChanged || !input.validation.candidateAvailable
    ? "stale"
    : isValidationCurrent(input.validation)
      ? "valid"
      : "review";

  return {
    ...input.override,
    status,
    validation: input.validation,
    lastValidatedAgainstRevisionId: input.currentSourceRevisionId,
  };
}
