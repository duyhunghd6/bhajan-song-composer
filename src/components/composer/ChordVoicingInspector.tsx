"use client";

import { Button } from "@/components/ui/Button";


import { useState } from "react";

/** The only ranges that a beat-level voicing edit is allowed to target. */
export type VoicingOverrideScope = "window" | "phrase" | "section";

export const VOICING_OVERRIDE_SCOPE_OPTIONS: ReadonlyArray<{
  value: VoicingOverrideScope;
  label: string;
}> = [
  { value: "window", label: "This chord window" },
  { value: "phrase", label: "Phrase" },
  { value: "section", label: "Section" },
];

export type VoicingInstrument = "guitar" | "piano";
export type VoicingCandidateStatus = "current" | "valid" | "review" | "invalid" | "stale";
export type VoicingAuditionMode = "idle" | "current" | "candidate" | "ab-loop";

export interface StrongBeatChordWindowContext {
  /** Stable chord-window identity; this is the default override target. */
  chordWindowId: string;
  measure: number;
  beat: number;
  /** The locked harmonic identity. Candidate selection must not alter this value. */
  chordIdentity: string;
  singer?: {
    activity: "attack" | "sustain" | "rest";
    note?: string;
  };
  profileName?: string;
  /** A human-readable loop boundary supplied by the playback owner. */
  previewRangeLabel?: string;
}

export interface GuitarVoicingCandidateDetails {
  shape: string;
  register?: string;
  strings?: string;
  bass?: string;
  capo?: string;
  transition?: string;
}

export interface PianoVoicingCandidateDetails {
  leftHand: string;
  rightHand: string;
  inversion?: string;
  register?: string;
  spacing?: string;
  handSpan?: string;
}

export interface VoicingCandidate {
  id: string;
  instrument: VoicingInstrument;
  /** Candidate name, e.g. “Am E-form barre f5”. */
  label: string;
  status: VoicingCandidateStatus;
  details: GuitarVoicingCandidateDetails | PianoVoicingCandidateDetails;
  warning?: string;
}

export interface VoicingAuditionRequest {
  mode: Exclude<VoicingAuditionMode, "idle">;
  chordWindowId: string;
  currentCandidateId?: string;
  candidateId?: string;
}

export interface ChordVoicingInspectorProps {
  context: StrongBeatChordWindowContext;
  candidates: readonly VoicingCandidate[];
  /** Controlled when supplied; otherwise the inspector owns the selected scope. */
  scope?: VoicingOverrideScope;
  /** Controlled when supplied; otherwise the inspector owns the candidate selection. */
  selectedCandidateId?: string;
  auditionMode?: VoicingAuditionMode;
  onScopeChange?: (scope: VoicingOverrideScope) => void;
  onCandidateChange?: (candidate: VoicingCandidate) => void;
  onAuditionRequest?: (request: VoicingAuditionRequest) => void;
  onApplyCandidate?: (candidate: VoicingCandidate, scope: VoicingOverrideScope) => void;
  onResetOverride?: () => void;
  className?: string;
}

export interface ChordVoicingInspectorModel {
  currentCandidate?: VoicingCandidate;
  selectedCandidate?: VoicingCandidate;
  guitarCandidates: VoicingCandidate[];
  pianoCandidates: VoicingCandidate[];
}

/**
 * A small pure adapter so callers and tests share the same A/B selection rules.
 * A stale or invalid candidate may be inspected but is never applicable.
 */
export function buildChordVoicingInspectorModel(
  candidates: readonly VoicingCandidate[],
  selectedCandidateId?: string,
): ChordVoicingInspectorModel {
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId)
    ?? candidates.find((candidate) => candidate.status === "current");
  // A/B is always between two realizations of the same instrument. The
  // inspector can show both Guitar and Piano, but must not compare their
  // unlike timbres as though they were alternative shapes on one instrument.
  const currentCandidate = candidates.find((candidate) => (
    candidate.instrument === selectedCandidate?.instrument && candidate.status === "current"
  )) ?? candidates.find((candidate) => candidate.status === "current");

  return {
    currentCandidate,
    selectedCandidate,
    guitarCandidates: candidates.filter((candidate) => candidate.instrument === "guitar"),
    pianoCandidates: candidates.filter((candidate) => candidate.instrument === "piano"),
  };
}

function isGuitarDetails(
  details: GuitarVoicingCandidateDetails | PianoVoicingCandidateDetails,
): details is GuitarVoicingCandidateDetails {
  return "shape" in details;
}

function statusLabel(status: VoicingCandidateStatus) {
  return status.toUpperCase();
}

function CandidateDetails({ candidate }: { candidate: VoicingCandidate }) {
  if (isGuitarDetails(candidate.details)) {
    const details = candidate.details;
    return (
      <span className="block text-xs text-zinc-600 dark:text-zinc-300">
        {[details.register, details.strings, details.bass, details.capo, details.transition]
          .filter(Boolean)
          .join(" · ")}
      </span>
    );
  }

  const details = candidate.details;
  return (
    <span className="block text-xs text-zinc-600 dark:text-zinc-300">
      {details.leftHand} <span aria-hidden="true">|</span> {details.rightHand}
      {[details.inversion, details.register, details.spacing, details.handSpan]
        .filter(Boolean)
        .map((detail) => ` · ${detail}`)}
    </span>
  );
}

function CandidateGroup({
  title,
  candidates,
  selectedCandidateId,
  onSelect,
}: {
  title: string;
  candidates: readonly VoicingCandidate[];
  selectedCandidateId?: string;
  onSelect: (candidate: VoicingCandidate) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <fieldset className="grid gap-2" aria-label={`${title} voicing candidates`}>
      <legend className="text-xs font-bold tracking-wide text-zinc-600 dark:text-zinc-300">{title}</legend>
      {candidates.map((candidate) => {
        const selected = candidate.id === selectedCandidateId;
        return (
          <label
            key={candidate.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${selected ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"}`}
          >
            <input
              type="radio"
              name="voicing-candidate"
              value={candidate.id}
              checked={selected}
              onChange={() => onSelect(candidate)}
              aria-label={`${candidate.label} (${statusLabel(candidate.status)})`}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{candidate.label}</span>
                <span className="text-[10px] font-bold text-zinc-500">{statusLabel(candidate.status)}</span>
              </span>
              <CandidateDetails candidate={candidate} />
              {candidate.warning && (
                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">Warning: {candidate.warning}</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * Presentational inspector for a locked chord at one selected strong beat.
 * It deliberately owns no harmony, renderer, playback, or workspace persistence state.
 */
export function ChordVoicingInspector({
  context,
  candidates,
  scope: controlledScope,
  selectedCandidateId: controlledSelectedCandidateId,
  auditionMode = "idle",
  onScopeChange,
  onCandidateChange,
  onAuditionRequest,
  onApplyCandidate,
  onResetOverride,
  className = "",
}: ChordVoicingInspectorProps) {
  const [uncontrolledScope, setUncontrolledScope] = useState<VoicingOverrideScope>("window");
  const [uncontrolledSelectedCandidateId, setUncontrolledSelectedCandidateId] = useState<string | undefined>();
  const scope = controlledScope ?? uncontrolledScope;
  const selectedCandidateId = controlledSelectedCandidateId ?? uncontrolledSelectedCandidateId;
  const model = buildChordVoicingInspectorModel(candidates, selectedCandidateId);
  const currentCandidateId = model.currentCandidate?.id;
  const canApply = model.selectedCandidate?.status === "current" || model.selectedCandidate?.status === "valid";
  const loopLabel = context.previewRangeLabel ?? `m.${Math.max(1, context.measure - 1)}–${context.measure + 1}`;

  const selectCandidate = (candidate: VoicingCandidate) => {
    if (controlledSelectedCandidateId === undefined) setUncontrolledSelectedCandidateId(candidate.id);
    onCandidateChange?.(candidate);
  };

  const selectScope = (nextScope: VoicingOverrideScope) => {
    if (controlledScope === undefined) setUncontrolledScope(nextScope);
    onScopeChange?.(nextScope);
  };

  const requestAudition = (mode: Exclude<VoicingAuditionMode, "idle">) => {
    onAuditionRequest?.({
      mode,
      chordWindowId: context.chordWindowId,
      currentCandidateId,
      candidateId: model.selectedCandidate?.id,
    });
  };

  return (
    <aside className={`rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`} aria-label="Chord and voicing inspector">
      <header className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Strong beat: m.{context.measure} · beat {context.beat} · {context.chordIdentity}
        </p>
        {context.singer && (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Singer: {context.singer.activity}{context.singer.note ? ` (${context.singer.note})` : ""}
          </p>
        )}
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Scope
          <select
            value={scope}
            onChange={(event) => selectScope(event.target.value as VoicingOverrideScope)}
            className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            aria-label="Voicing override scope"
          >
            {VOICING_OVERRIDE_SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <span className="text-sm text-zinc-600 dark:text-zinc-300">
          Current: {model.currentCandidate?.label ?? "No current realization"}
          {context.profileName ? ` · profile: ${context.profileName}` : ""}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Voicing audition controls">
        <Button variant="secondary" size="sm" type="button" onClick={() => requestAudition("current")} disabled={!currentCandidateId} >Play current</Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => requestAudition("candidate")} disabled={!model.selectedCandidate} >Play candidate</Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => requestAudition("ab-loop")} disabled={!currentCandidateId || !model.selectedCandidate} >A/B loop {loopLabel}</Button>
      </div>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300" aria-live="polite">
        A: {model.currentCandidate?.label ?? "—"} · B: {model.selectedCandidate?.label ?? "—"} · {auditionMode === "idle" ? "Ready to audition" : `Auditioning ${auditionMode}`}
      </p>

      <div className="mt-4 grid gap-4">
        <CandidateGroup title="GUITAR — same chord, different realization" candidates={model.guitarCandidates} selectedCandidateId={model.selectedCandidate?.id} onSelect={selectCandidate} />
        <CandidateGroup title="PIANO — same chord, different realization" candidates={model.pianoCandidates} selectedCandidateId={model.selectedCandidate?.id} onSelect={selectCandidate} />
      </div>

      <footer className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Button variant="primary" size="md" type="button" onClick={() => model.selectedCandidate && onApplyCandidate?.(model.selectedCandidate, scope)} disabled={!canApply} >Apply voicing</Button>
        {onResetOverride && <Button variant="danger" size="sm" type="button" onClick={onResetOverride} >Reset override</Button>}
      </footer>
    </aside>
  );
}
