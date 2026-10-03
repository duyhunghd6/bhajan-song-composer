import { Chord, Note } from "@tonaljs/tonal";
import type { ComposerProjectPayload, JsonValue } from "@/lib/composer-project";
import { guitarChordShapes } from "@/lib/theory/guitar-chord-score";
import { scientificPitchToAbc } from "@/lib/theory/fingerstyle-arranger/time-slice-abc-renderer";
import {
  type GuitarVoicingCandidate,
  type PianoVoicingCandidate,
  type VoicingCandidate as DomainVoicingCandidate,
  type VoicingChordIdentity,
  type VoicingOverride,
  type VoicingOverrideScope,
  type VoicingWindowRange,
  revalidateVoicingOverride,
  selectNarrowestApplicableOverride,
} from "@/lib/theory/voicing-override";
import { fingerprintAccompanimentSource } from "@/lib/theory/accompaniment-workflow";
import type {
  ChordVoicingInspectorProps,
  StrongBeatChordWindowContext,
  VoicingAuditionRequest,
  VoicingCandidate as InspectorCandidate,
  VoicingOverrideScope as InspectorScope,
} from "../ChordVoicingInspector";
import type { WorkspaceState } from "../useWorkspaceState";

const VALID_CHECK = { valid: true, reasons: [] };

export interface InspectorTarget {
  context: StrongBeatChordWindowContext;
  chordIdentity: VoicingChordIdentity;
  windowRange: VoicingWindowRange;
  phraseRange: VoicingWindowRange;
  sectionRange: VoicingWindowRange;
  sourceRevisionId: string;
  candidatesById: Record<string, DomainVoicingCandidate>;
}

export interface InspectorIntegration {
  target: InspectorTarget;
  candidates: InspectorCandidate[];
}

export interface VoicingAuditionPreview {
  abc: string;
  title: string;
}

function toMidi(note: string, fallback: number): number {
  return Note.midi(note) ?? fallback;
}

function normalizedChordSymbol(symbol: string): string {
  const parsed = Chord.get(symbol);
  return parsed.empty ? symbol.trim().toLowerCase() : parsed.name.toLowerCase().replace(/\s+/g, "");
}

function range(scope: VoicingOverrideScope, startMeasureIndex: number, endMeasureIndex: number, chordWindowId: string): VoicingWindowRange {
  return {
    scope,
    ...(scope === "chord-window" ? { chordWindowId } : scope === "phrase" ? { phraseId: `phrase-${startMeasureIndex + 1}` } : { sectionId: "accompaniment-section" }),
    start: { measureIndex: startMeasureIndex, beat: 1 },
    end: { measureIndex: endMeasureIndex + 1, beat: 1 },
  };
}

function candidateValidation(valid: boolean, reason?: string) {
  const check = valid ? VALID_CHECK : { valid: false, reasons: [reason ?? "Candidate needs review."] };
  return { chordIdentity: VALID_CHECK, singerYield: VALID_CHECK, physical: check };
}

function guitarCandidates(
  chordSymbol: string,
  identity: VoicingChordIdentity,
  currentOverride: VoicingOverride | undefined,
): Array<{ inspector: InspectorCandidate; domain: GuitarVoicingCandidate }> {
  return guitarChordShapes(chordSymbol).map((voicing, index) => {
    const fretted = voicing.frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
    const positionFret = fretted.length ? Math.min(...fretted) : 0;
    const span = fretted.length ? Math.max(...fretted) - positionFret : 0;
    const physical = span <= 5;
    const id = `guitar:${identity.normalizedSymbol}:${voicing.frets.join("-")}`;
    const sounding = voicing.frets.flatMap((fret, stringIndex) => (
      typeof fret === "number" ? [Note.fromMidi([40, 45, 50, 55, 59, 64][stringIndex] + fret)] : []
    ));
    const domain: GuitarVoicingCandidate = {
      instrument: "guitar-classic",
      voicingId: id,
      chordIdentity: identity,
      spelledPitches: sounding,
      register: { lowestMidi: Math.min(...sounding.map((note) => toMidi(note, 40))), highestMidi: Math.max(...sounding.map((note) => toMidi(note, 64))) },
      transitionCost: span + (voicing.barre ? 2 : 0),
      validation: candidateValidation(physical, "Fret span exceeds the compact-shape review limit."),
      shapeLabel: voicing.label,
      positionFret,
      frets: voicing.frets,
      strings: voicing.frets.flatMap((fret, stringIndex) => fret === "X" ? [] : [6 - stringIndex]),
      ...(voicing.barre ? { barre: voicing.barre } : {}),
      fingerCost: voicing.fingers?.filter((finger) => finger !== "X").length ?? fretted.length,
      bassNote: sounding[0] ?? "",
      capo: 0,
    };
    return {
      domain,
      inspector: {
        id,
        instrument: "guitar",
        label: `${chordSymbol} · ${domain.shapeLabel}`,
        status: currentOverride?.voicingId === id ? "current" : index === 0 && !currentOverride ? "current" : physical ? "valid" : "review",
        details: {
          shape: domain.shapeLabel,
          register: `${positionFret === 0 ? "low" : positionFret < 6 ? "mid" : "high"} register`,
          strings: `strings ${domain.strings.join("–")}`,
          bass: `bass ${domain.bassNote}`,
          transition: domain.transitionCost <= 3 ? "easy transition" : `transition cost ${domain.transitionCost}`,
        },
        ...(physical ? {} : { warning: "Fret span needs playability review." }),
      },
    };
  });
}

function pianoCandidates(
  chordSymbol: string,
  identity: VoicingChordIdentity,
  currentOverride: VoicingOverride | undefined,
): Array<{ inspector: InspectorCandidate; domain: PianoVoicingCandidate }> {
  const parsed = Chord.get(chordSymbol);
  const notes = parsed.empty || parsed.notes.length === 0 ? ["C", "E", "G"] : parsed.notes;
  const root = parsed.tonic ?? notes[0];
  const ordered = [root, ...notes.filter((note) => note !== root)];
  return [0, 1].map((inversionIndex) => {
    const rightHandNotes = [...ordered.slice(inversionIndex), ...ordered.slice(0, inversionIndex)]
      .map((note, index) => `${note}${4 + (index < ordered.length - inversionIndex ? 0 : 1)}`);
    const leftHandPitches = [`${root}2`, `${ordered[Math.min(1, ordered.length - 1)]}3`];
    const id = `piano:${identity.normalizedSymbol}:${inversionIndex}`;
    const domain: PianoVoicingCandidate = {
      instrument: "piano",
      voicingId: id,
      chordIdentity: identity,
      spelledPitches: [...leftHandPitches, ...rightHandNotes],
      register: { lowestMidi: toMidi(leftHandPitches[0], 36), highestMidi: toMidi(rightHandNotes.at(-1) ?? "C5", 72) },
      transitionCost: inversionIndex + 1,
      validation: candidateValidation(true),
      inversion: inversionIndex === 0 ? "root" : "first",
      leftHandPitches,
      rightHandPitches: rightHandNotes,
      spacingSemitones: toMidi(rightHandNotes.at(-1) ?? "C5", 72) - toMidi(rightHandNotes[0] ?? "C4", 60),
      leftHandSpanSemitones: toMidi(leftHandPitches[1], 48) - toMidi(leftHandPitches[0], 36),
      rightHandSpanSemitones: toMidi(rightHandNotes.at(-1) ?? "C5", 72) - toMidi(rightHandNotes[0] ?? "C4", 60),
      bassTreatment: "open-fifth",
    };
    return {
      domain,
      inspector: {
        id,
        instrument: "piano",
        label: `${chordSymbol} · ${domain.inversion} inversion`,
        status: currentOverride?.voicingId === id ? "current" : inversionIndex === 0 && !currentOverride ? "current" : "valid",
        details: {
          leftHand: leftHandPitches.join("–"),
          rightHand: rightHandNotes.join("–"),
          inversion: `${domain.inversion} inversion`,
          register: inversionIndex === 0 ? "close / mid register" : "upper inversion",
          handSpan: `RH ${domain.rightHandSpanSemitones} semitones`,
        },
      },
    };
  });
}

/** Maps the immutable pipeline harmony to one editable selected chord-window. */
export function buildInspectorIntegration(input: {
  chordSymbol: string;
  measureIndex: number;
  measureCount: number;
  windowRange?: VoicingWindowRange;
  strongBeatNotes: string[];
  sourceAbc: string;
  profileName?: string;
  overrides: readonly VoicingOverride[];
}): InspectorIntegration {
  const chordWindowId = input.windowRange?.chordWindowId ?? `m${input.measureIndex + 1}-beat1-${normalizedChordSymbol(input.chordSymbol)}`;
  const windowRange = input.windowRange ?? range("chord-window", input.measureIndex, input.measureIndex, chordWindowId);
  const identity: VoicingChordIdentity = {
    symbol: input.chordSymbol,
    normalizedSymbol: normalizedChordSymbol(input.chordSymbol),
    chordWindowIds: [chordWindowId],
  };
  const sourceRevisionId = fingerprintAccompanimentSource(input.sourceAbc);
  const currentOverrides = input.overrides.filter((override) => override.sourceRevisionId === sourceRevisionId);
  const currentGuitar = selectNarrowestApplicableOverride(currentOverrides, "guitar-classic", windowRange, identity);
  const currentPiano = selectNarrowestApplicableOverride(currentOverrides, "piano", windowRange, identity);
  const guitar = guitarCandidates(input.chordSymbol, identity, currentGuitar);
  const piano = pianoCandidates(input.chordSymbol, identity, currentPiano);
  const phraseStart = Math.floor(input.measureIndex / 2) * 2;
  const phraseEnd = Math.min(input.measureCount - 1, phraseStart + 1);
  const target: InspectorTarget = {
    context: {
      chordWindowId,
      measure: input.measureIndex + 1,
      beat: windowRange.start.beat,
      chordIdentity: input.chordSymbol,
      singer: { activity: input.strongBeatNotes.length ? "attack" : "rest", note: input.strongBeatNotes[0] },
      profileName: input.profileName,
    },
    chordIdentity: identity,
    windowRange,
    phraseRange: range("phrase", phraseStart, phraseEnd, chordWindowId),
    sectionRange: range("section", 0, Math.max(0, input.measureCount - 1), chordWindowId),
    sourceRevisionId,
    candidatesById: Object.fromEntries([...guitar, ...piano].map(({ inspector, domain }) => [inspector.id, domain])),
  };
  return { target, candidates: [...guitar, ...piano].map(({ inspector }) => inspector) };
}

function domainScope(scope: InspectorScope): VoicingOverrideScope {
  return scope === "window" ? "chord-window" : scope;
}

export function createVoicingOverride(input: {
  target: InspectorTarget;
  inspectorCandidate: InspectorCandidate;
  scope: InspectorScope;
  createdAt?: string;
}): VoicingOverride {
  const candidate = input.target.candidatesById[input.inspectorCandidate.id];
  if (!candidate) throw new Error("The selected voicing is not available for this immutable harmony window.");
  const rangeByScope: Record<VoicingOverrideScope, VoicingWindowRange> = {
    "chord-window": input.target.windowRange,
    phrase: input.target.phraseRange,
    section: input.target.sectionRange,
  };
  const physical = candidate.validation.physical;
  return {
    id: `override-${input.target.sourceRevisionId.slice(0, 10)}-${candidate.voicingId.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}`,
    instrument: candidate.instrument,
    windowRange: rangeByScope[domainScope(input.scope)],
    baseChordIdentity: input.target.chordIdentity,
    voicingId: candidate.voicingId,
    sourceRevisionId: input.target.sourceRevisionId,
    createdFromPlanRevisionId: "inspector-candidate-pack-v1",
    createdAt: input.createdAt ?? new Date().toISOString(),
    validation: {
      evaluatedAt: input.createdAt ?? new Date().toISOString(),
      candidateAvailable: true,
      chordIdentity: candidate.validation.chordIdentity,
      singerYield: candidate.validation.singerYield,
      physical,
      leftEdgeTransition: VALID_CHECK,
      rightEdgeTransition: VALID_CHECK,
      diagnostics: physical.valid ? [] : physical.reasons,
    },
    status: physical.valid ? "valid" : "review",
  };
}

function candidateMeasure(candidate: DomainVoicingCandidate, role: string): string {
  const pitches = candidate.spelledPitches.map((pitch) => scientificPitchToAbc(pitch)).join("") || "C";
  return `"${candidate.chordIdentity.symbol} ${role}" [${pitches}]4`;
}

/**
 * Small, standalone ABC used only for audition. It has no melody/harmony
 * source body, so previewing a candidate can never mutate or become the
 * branch's selected Harmony source.
 */
export function buildVoicingAuditionPreview(
  target: InspectorTarget,
  request: VoicingAuditionRequest,
): VoicingAuditionPreview | null {
  const current = request.currentCandidateId ? target.candidatesById[request.currentCandidateId] : undefined;
  const candidate = request.candidateId ? target.candidatesById[request.candidateId] : undefined;
  const selected = request.mode === "current" ? current : candidate ?? current;
  if (!selected) return null;
  const measures = request.mode === "ab-loop" && current && candidate
    ? [candidateMeasure(current, "A current"), candidateMeasure(candidate, "B candidate")]
    : [candidateMeasure(selected, request.mode === "current" ? "current" : "candidate")];
  const program = selected.instrument === "guitar-classic" ? 24 : 1;
  const title = request.mode === "ab-loop"
    ? `A/B audition · m.${target.context.measure} · ${target.context.chordIdentity}`
    : `${selected.instrument === "guitar-classic" ? "Guitar" : "Piano"} audition · ${target.context.chordIdentity}`;
  return {
    title,
    abc: [
      "X:1",
      `T:${title}`,
      "M:4/4",
      "L:1/4",
      "Q:1/4=72",
      "K:C",
      `%%MIDI program ${program}`,
      "V:Candidate name=\"Voicing audition\"",
      `| ${measures.join(" | ")} |`,
    ].join("\n"),
  };
}

/** Source changes retain every decision but make it explicit that it needs review. */
export function revalidateVoicingOverridesForSource(
  overrides: readonly VoicingOverride[],
  sourceAbc: string,
  evaluatedAt = new Date().toISOString(),
): VoicingOverride[] {
  const currentSourceRevisionId = fingerprintAccompanimentSource(sourceAbc);
  return overrides.map((override) => revalidateVoicingOverride({
    override,
    currentSourceRevisionId,
    validation: {
      ...override.validation,
      evaluatedAt,
      candidateAvailable: false,
      diagnostics: [...override.validation.diagnostics, "Harmony source changed; revalidate this voicing before rendering."],
    },
  }));
}

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}

/**
 * Build a durable snapshot without mutating the source ABC or the workflow.
 * Browser storage may prune this data; the Project payload deliberately keeps
 * raw runs and all options for audit/restore.
 */
export function buildAccompanimentProjectPayload(input: {
  slug: string;
  activeAbc: string;
  branchSourceAbc: string | null;
  workspace: WorkspaceState;
}): ComposerProjectPayload {
  const sourceAbc = input.branchSourceAbc ?? input.activeAbc;
  const sourceFingerprint = fingerprintAccompanimentSource(sourceAbc);
  const workflow = input.workspace.accompanimentWorkflow;
  const runs = workflow
    ? Object.values(workflow.steps).flatMap((stepState) => stepState.runs.map((run) => ({
      id: run.id,
      input: json({ stepId: run.stepId, requestPrompt: run.requestPrompt, userNote: run.userNote }),
      rawOutput: json(run.rawResult),
      normalizedOutput: json(run.options),
      diagnostics: json(run.diagnostics),
      selectedOptionId: stepState.selectedOptionId ?? undefined,
    })))
    : [];
  return {
    song: {
      slug: input.slug,
      sourceRevisionId: sourceFingerprint,
      sourceFingerprint,
      metadata: { activeStep: "accompaniment", harmonySourceLocked: Boolean(input.branchSourceAbc) },
    },
    steps: {
      accompaniment: {
        input: json({ sourceAbc, activeAbc: input.activeAbc, branchSourceAbc: input.branchSourceAbc, setup: workflow?.setup ?? null }),
        runs,
        selectedOptionId: workflow?.steps[workflow.currentStepId]?.selectedOptionId ?? undefined,
      },
    },
    decisions: json({
      voicingOverrides: input.workspace.voicingOverrides,
      accompanimentWorkflow: workflow,
    }) as Record<string, JsonValue>,
    artifacts: [
      ...(input.workspace.generatedAccompaniment ? [{ id: `accompaniment-abc-${sourceFingerprint}`, kind: "abc" as const, contentType: "text/vnd.abc", uri: "workspace:generated-accompaniment" }] : []),
      ...(input.workspace.generatedGuitar ? [{ id: `guitar-abc-${sourceFingerprint}`, kind: "abc" as const, contentType: "text/vnd.abc", uri: "workspace:generated-guitar" }] : []),
    ],
  };
}

export type AccompanimentInspectorProps = Pick<ChordVoicingInspectorProps, "context" | "candidates">;
