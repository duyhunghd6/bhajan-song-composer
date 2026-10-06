import { Button, buttonStyles } from "@/components/ui/Button";
import Link from "next/link";
import styles from "./harmony.module.css";
import { HarmonyStrummingPanel } from "./HarmonyStrummingPanel";
import { currentStrummingSelection, generateStrummingCandidates, type StrummingSelection } from "@/lib/theory/harmony/strumming";
import { HarmonyCopyButton } from "./HarmonyCopyButton";
import { HarmonyPanelResizeHandle } from "./HarmonyPanelResizeHandle";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ScoreViewport } from "@/components/music-sheet/score-workspace/ScoreViewport";
import { applyAbcLayerVolumes, extractAbcVoiceIds, isAbcLayerVisible } from "@/lib/theory/abc-layer-visibility";
import { buildHarmonyLayerProjection, HARMONY_ANALYSIS_LAYERS } from "@/lib/theory/harmony/analysis-preview";
import { fillMissingMeasureChords } from "@/lib/theory/harmony/auto-chords";
import { editScoreChord } from "@/lib/theory/score-chord-edit";
import { buildHarmonyValidationBranchResetState } from "./accompaniment-guitar-reset";
import { restoreScoreHarmonyDraft, serializeScoreHarmonyDraft } from "./score-draft-storage";
import { selectManualScoreHarmony } from "./score-harmony-selection";
import { getComposerFingerstyleMeasuresStorageKey, getComposerSongStoragePrefix } from "./storage";
import GuitarChordAccompaniment from "@/components/music-sheet/guitar-chords/GuitarChordAccompaniment";
import type { ArrangementPipelineResult } from "@/lib/theory/arrangement-pipeline";
import type { WorkspaceState } from "../useWorkspaceState";
import AccompanimentWorkflowWizard from "../AccompanimentWorkflowWizard";
import type { HarmonyPreviewModel } from "./arrangement-preview-model";
import { LayerVisibilityControls } from "./LayerVisibilityControls";
import {
  COMPOSER_PREVIEW_RENDER_OPTIONS,
  COMPOSER_STAFF_PLAYBACK_PROPS,
} from "./preview";

interface HarmonyStepProps {
  slug: string;
  melodyAbc: string;
  sourceAbc: string;
  initialMelodyAbc?: string;
  hasMounted: boolean;
  pipeline: ArrangementPipelineResult | null;
  harmonyPreview: HarmonyPreviewModel;
  layerVisibility: Record<string, boolean>;
  setLayerVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  layerVolumes: Record<string, number>;
  setLayerVolumes: Dispatch<SetStateAction<Record<string, number>>>;
  ws: WorkspaceState;
  updateState: (updates: Partial<WorkspaceState>) => void;
  onRestore: () => void;
  onScoreTransaction: (melody: string, workspace: WorkspaceState, fingerstyleCache: string | null) => void;
}

export function HarmonyStep({
  slug,
  melodyAbc,
  sourceAbc,
  initialMelodyAbc,
  hasMounted,
  pipeline,
  harmonyPreview,
  layerVisibility,
  setLayerVisibility,
  layerVolumes,
  setLayerVolumes,
  ws,
  updateState,
  onRestore,
  onScoreTransaction,
}: HarmonyStepProps) {
  const [mode, setMode] = useState<"explore" | "edit">("explore");
  const [error, setError] = useState("");
  const [storedDraft, setDraft] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState(sourceAbc);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const draft = draftSource === sourceAbc ? storedDraft : null;
  const draftKey = `${getComposerSongStoragePrefix(slug)}manual-harmony-draft`;
  useEffect(() => {
    if (!hasMounted || draftHydrated) return;
    const saved = restoreScoreHarmonyDraft(window.localStorage.getItem(draftKey), melodyAbc, sourceAbc);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore source-bound browser storage after hydration before writing it.
    setDraft(saved); setDraftSource(sourceAbc); setDraftHydrated(true);
  }, [hasMounted, draftHydrated, draftKey, melodyAbc, sourceAbc]);
  useEffect(() => {
    if (!hasMounted || !draftHydrated) return;
    if (draft) window.localStorage.setItem(draftKey, serializeScoreHarmonyDraft(draft, melodyAbc, sourceAbc));
    else window.localStorage.removeItem(draftKey);
  }, [draft, draftKey, draftHydrated, hasMounted, melodyAbc, sourceAbc]);
  type Snapshot = { melody: string; workspace: WorkspaceState; draft: string | null; draftReference: string; cache: string | null };
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const snapshot = (): Snapshot => ({ melody: melodyAbc, workspace: ws, draft, draftReference: sourceAbc, cache: typeof window === "undefined" ? null : window.localStorage.getItem(getComposerFingerstyleMeasuresStorageKey(slug)) });
  const commit = (next: Snapshot) => {
    setPast([...past, snapshot()]); setFuture([]); setDraft(next.draft); setDraftSource(next.draftReference);
    onScoreTransaction(next.melody, next.workspace, next.cache); setError("");
  };
  const restore = (next: Snapshot) => { setDraft(next.draft); setDraftSource(next.draftReference); onScoreTransaction(next.melody, next.workspace, next.cache); setError(""); };
  const restoreOriginal = () => { setDraft(null); setPast([]); setFuture([]); onRestore(); };
  const strummingEnabled = harmonyPreview.harmonyStepComplete && !draft;
  const strummingPreview = ws.harmonyStrummingPreview;
  const setStrummingPreview = (selection: StrummingSelection | null) => updateState({ harmonyStrummingPreview: selection });
  const savedStrumming = strummingEnabled ? currentStrummingSelection(ws.harmonyStrumming, sourceAbc) : null;
  const selectedStrumming = strummingEnabled ? currentStrummingSelection(strummingPreview, sourceAbc) ?? savedStrumming : null;
  const strummingTechniques = selectedStrumming?.techniques;
  const strummingStyleId = selectedStrumming?.styleId;
  const strummingResult = useMemo(() => {
    if (!strummingStyleId) return { candidates: [], error: "" };
    try { return { candidates: generateStrummingCandidates(sourceAbc, strummingStyleId, ws.voicingOverrides, strummingTechniques), error: "" }; }
    catch (cause) { return { candidates: [], error: cause instanceof Error ? cause.message : "Unable to generate accompaniment." }; }
  }, [sourceAbc, strummingStyleId, ws.voicingOverrides, strummingTechniques]);
  const strumming = strummingResult.candidates[selectedStrumming?.variant ?? -1];
  const projection = useMemo(() => buildHarmonyLayerProjection(strumming ? applyAbcLayerVolumes(strumming.abc, layerVolumes) : draft ? applyAbcLayerVolumes(draft, layerVolumes) : harmonyPreview.rawAbc, layerVisibility, draft ? undefined : melodyAbc), [strumming, draft, layerVolumes, harmonyPreview.rawAbc, layerVisibility, melodyAbc]);
  const scoreAbc = projection.abc;
  const timeGridJson = JSON.stringify(strumming?.timeGrid ?? projection.timeGrid, null, 2);
  const chordAudioDefault = !strumming;
  const chordAudioEnabled = isAbcLayerVisible("ChordAccompaniment", layerVisibility, chordAudioDefault);
  const chordAudioVolume = layerVolumes.ChordAccompaniment ?? layerVolumes.ChordProgression ?? 100;
  const visibilityItems = [...harmonyPreview.layerVisibilityItems.filter(item => !HARMONY_ANALYSIS_LAYERS.some(layer => layer.id === item.id))
    .flatMap(item => item.id === "ChordProgression" ? [
      { ...item, label: "Chord Progression", supportsVolume: false },
      { ...item, id: "ChordAccompaniment", label: "Chord Accompaniment", kind: "render" as const, defaultVisible: chordAudioDefault, supportsVolume: true },
    ] : [item]), ...HARMONY_ANALYSIS_LAYERS, ...(strumming ? [{ id: "GuitarStrumming", label: "Strumming", kind: "voice" as const, defaultVisible: true, enabled: true, supportsVolume: true }] : [])];
  const publishDraft = () => {
    if (!draft) return;
    try {
      const reset = buildHarmonyValidationBranchResetState(ws);
      const workflow = selectManualScoreHarmony(reset.accompanimentWorkflow ?? ws.accompanimentWorkflow, draft, sourceAbc);
      commit({ melody: melodyAbc, workspace: { ...ws, ...reset, accompanimentWorkflow: workflow, voicingOverrides: [] }, draft: null, draftReference: sourceAbc, cache: null });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to validate manual harmony."); }
  };
  return (
    <div className={`${styles.workspace} ${styles.harmonyWorkspace}`} onKeyDown={(event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || (event.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;
      event.preventDefault();
      if (event.shiftKey && future.length) { const next = future[future.length - 1]; setFuture(future.slice(0, -1)); setPast([...past, snapshot()]); restore(next); }
      else if (!event.shiftKey && past.length) { const next = past[past.length - 1]; setPast(past.slice(0, -1)); setFuture([...future, snapshot()]); restore(next); }
    }}>
      <section className={styles.score} aria-label="Harmony score preview">
        <GuitarChordAccompaniment
          renderScore={(score, playback) => <ScoreViewport embedded controllerSlot={playback.controllerSlot} label="Harmony score">{score}</ScoreViewport>}
          sourceAbc={draft ?? sourceAbc}
          overrides={ws.voicingOverrides}
          onOverridesChange={(voicingOverrides) => commit({ ...snapshot(), workspace: { ...ws, voicingOverrides } })}
          scoreEditing={{ mode, sourceAbc: melodyAbc, onCommit: (abc) => commit({ melody: abc, workspace: { ...ws, ...buildHarmonyValidationBranchResetState(ws), accompanimentWorkflow: null, voicingOverrides: [] }, draft: null, draftReference: sourceAbc, cache: null }), onError: setError }}
          onChordEdit={mode === "edit" ? (occurrence, symbol) => {
            try { commit({ ...snapshot(), draft: editScoreChord(isAbcLayerVisible("MissingChord", layerVisibility, false) ? fillMissingMeasureChords(draft ?? sourceAbc).abc : draft ?? sourceAbc, occurrence.measureIndex, occurrence.beat, symbol) }); }
            catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to edit chord."); }
          } : undefined}
          writtenAccompaniment={Boolean(strumming)}
          chordAudioAbc={draft ?? sourceAbc}
          chordAudioEnabled={chordAudioEnabled}
          chordVolume={chordAudioVolume}
          abcString={scoreAbc}
          title="Harmonization Audio Preview"
          canvasId="composer-harmony-preview"
          synthOptions={strumming ? { chordsOff: true, voicesOff: isAbcLayerVisible("Melody", layerVisibility, true) ? undefined : extractAbcVoiceIds(scoreAbc).flatMap((voice, index) => voice === "Melody" ? [index] : []) } : harmonyPreview.synthOptions}
          renderOptions={harmonyPreview.getRenderOptionsFor(scoreAbc, COMPOSER_PREVIEW_RENDER_OPTIONS)}
          {...COMPOSER_STAFF_PLAYBACK_PROPS}
          minWidthClassName="min-w-0"
          sheetViewportClassName=""
        />
        {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
        <p role="status" className="p-3 text-sm text-zinc-500">{draft ? "Manual harmony draft — validate and select it before downstream generation." : !harmonyPreview.harmonyStepComplete && past.length ? "Harmony and downstream drafts are stale after melody editing. Select a new chord progression in Step 2." : mode === "edit" ? "Drag to select notes and chords. Cmd/Ctrl + drag pans. Option/Alt + drag a note changes pitch. Right-click for actions." : "Drag to select notes and chords. Cmd/Ctrl + drag pans. Switch to Edit to change pitches or chord symbols."}</p>
      </section>

      <aside className={styles.tools} aria-label="Score tools">
        <details className={styles.disclosure} open>
          <summary>Layers & volume <span>Adjust what you see and hear</span></summary>
          <div className={styles.mixer}>
            <LayerVisibilityControls
              items={visibilityItems}
              visibility={layerVisibility}
              onVisibilityChange={setLayerVisibility}
              volumes={{ ...layerVolumes, ChordAccompaniment: chordAudioVolume }}
              onVolumeChange={setLayerVolumes}
              iconVisibility
            />
          </div>
        </details>
      </aside>

      <aside className={styles.assistant} aria-label="Harmony assistant">
        <HarmonyPanelResizeHandle />
        <div className={styles.panelBody}>
          {draft && <Button type="button" onClick={publishDraft}>Validate & select manual harmony</Button>}
          {projection.issues.length > 0 && <p role="status" className="p-3 text-sm text-zinc-500">{projection.issues.join(" ")}</p>}
          {hasMounted && initialMelodyAbc && melodyAbc !== initialMelodyAbc && (
            <Button variant="danger" size="sm" type="button" onClick={restoreOriginal} className="mt-4">↺ Reset Original Melody</Button>
          )}
        </div>
        {hasMounted && <AccompanimentWorkflowWizard
          mode="harmony"
          sourceAbc={melodyAbc}
          metadata={{ key: pipeline?.harmonization.key ?? "Unknown", scale: pipeline?.harmonization.scale ?? "Unknown", timeSignature: pipeline?.harmonization.timeSignature ?? "4/4" }}
          workflow={ws.accompanimentWorkflow}
          workflowSetup={ws.accompanimentWorkflowSetup}
          onWorkflowChange={(accompanimentWorkflow) => updateState({ accompanimentWorkflow })}
          onWorkflowSetupChange={(accompanimentWorkflowSetup) => updateState({ accompanimentWorkflowSetup })}
          onReset={restoreOriginal}
          onHarmonyValidated={() => updateState({ harmonyStrummingExpanded: true })}
        />}
        <HarmonyStrummingPanel
          expanded={ws.harmonyStrummingExpanded ?? true}
          onExpandedChange={(harmonyStrummingExpanded) => updateState({ harmonyStrummingExpanded })}
          enabled={strummingEnabled}
          meter={strumming?.timeGrid.timeline[0]?.meter ?? projection.timeGrid?.timeline[0]?.meter ?? "4/4"}
          candidates={strummingResult.candidates}
          selected={selectedStrumming}
          saved={savedStrumming}
          error={strummingResult.error}
          onStyle={(styleId) => { setStrummingPreview({ sourceAbc, styleId, variant: 0, techniques: strummingTechniques }); setLayerVisibility(previous => ({ ...previous, GuitarStrumming: true })); }}
          onSelect={(selection) => { setStrummingPreview(selection); setLayerVisibility(previous => ({ ...previous, GuitarStrumming: true })); }}
          onSave={() => { if (strumming) { commit({ ...snapshot(), workspace: { ...ws, harmonyStrumming: strumming.selection, harmonyStrummingPreview: null } }); } }}
          onCancel={() => setStrummingPreview(null)}
        />
        <div className={styles.nextStep}>
          {harmonyPreview.harmonyStepComplete ? (
            <><p>Your harmony is ready. Add instruments to bring it to life.</p><Link className={buttonStyles({ variant: "primary" })} href={`/compose/${slug}/accompaniment`}>Continue to accompaniment <span aria-hidden="true">→</span></Link></>
          ) : (
            <p>Next: add accompaniment after choosing your chord progression in step 2.</p>
          )}
        </div>
        <div className={styles.dataDisclosures}>
          <details className={styles.disclosure}>
            <summary>ABC notation <span>Current layers · score & playback</span></summary>
            <HarmonyCopyButton text={scoreAbc} label="Copy Harmony playback ABC" />
            <pre aria-label="Harmony playback ABC" className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-4 font-mono text-xs leading-6 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">{scoreAbc}</pre>
          </details>
          <details className={styles.disclosure}>
            <summary>TimeGrid JSON <span>{strumming ? "Harmony & strumming" : "Harmony analysis"}</span></summary>
            <HarmonyCopyButton text={timeGridJson} label="Copy Harmony TimeGrid JSON" iconOnly />
            <pre aria-label="Harmony TimeGrid JSON" className="mt-4 max-h-64 overflow-auto p-3 text-xs">{timeGridJson}</pre>
          </details>
        </div>
        <div className={`${styles.panelBody} ${styles.assistantFooter}`}>
          <div className={styles.toolHeading}>
            <h1>Harmony</h1>
            <span className={styles.status} aria-live="polite">
              {draft ? "Manual draft" : harmonyPreview.harmonyStepComplete ? "Harmony validated" : "Source melody"}
            </span>
            <Link href={`/compose/${slug}/melody`} aria-label="Edit melody" title="Edit melody" className={buttonStyles({ variant: "ghost", size: "sm", className: styles.editLink })}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
