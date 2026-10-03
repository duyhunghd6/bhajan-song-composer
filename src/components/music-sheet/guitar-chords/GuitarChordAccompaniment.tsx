"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import abcjs from "abcjs";
import styles from "./guitar-chords.module.css";
import AbcjsPlaybackController from "../AbcjsPlaybackController";
import type { AbcjsPlaybackControllerProps, VisualObj } from "../abcjs-playback/types";
import { claimPlayback, registerPlayback, releasePlayback, unregisterPlayback } from "../playback-registry";
import {
  buildGuitarChordScore, createGuitarChordOverride, guitarShapeAuditionAbc, realizeGuitarChordAudio,
  type GuitarChordShape, type GuitarParsedTune,
} from "@/lib/theory/guitar-chord-score";
import type { VoicingOverride } from "@/lib/theory/voicing-override";
import { attachGuitarChordDiagrams, guitarDiagramMarkup } from "./diagram";

interface Props extends AbcjsPlaybackControllerProps {
  sourceAbc: string;
  overrides: VoicingOverride[];
  onOverridesChange: (overrides: VoicingOverride[]) => void;
  chordVolume?: number;
}
const GUITAR_SYNTH_OPTIONS = { chordsOff: true };

export default function GuitarChordAccompaniment({ sourceAbc, overrides, onOverridesChange, chordVolume = 100, ...props }: Props) {
  const score = useMemo(() => buildGuitarChordScore(props.abcString, sourceAbc, overrides), [props.abcString, sourceAbc, overrides]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyAll, setApplyAll] = useState(false);
  const [filter, setFilter] = useState("all");
  const [auditionError, setAuditionError] = useState("");
  const [listeningId, setListeningId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const auditionRef = useRef<InstanceType<typeof abcjs.synth.CreateSynth> | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const auditionVersion = useRef(0);
  const auditionId = useId();
  const selected = score.occurrences.find((occurrence) => occurrence.id === selectedId);
  const stopAudition = useCallback(() => {
    auditionVersion.current++;
    try { auditionRef.current?.stop(); } catch { /* A loading synth has no buffer yet. */ }
    auditionRef.current = null;
    setListeningId(null);
  }, []);
  useEffect(() => {
    registerPlayback(auditionId, stopAudition);
    return () => { stopAudition(); unregisterPlayback(auditionId); void contextRef.current?.close(); };
  }, [auditionId, stopAudition]);
  useEffect(() => {
    if (selected && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!selected) dialogRef.current?.close();
  }, [selected]);
  const close = () => { stopAudition(); releasePlayback(auditionId); setSelectedId(null); };
  const open = useCallback((id: string) => { setApplyAll(false); setFilter("all"); setSelectedId(id); }, []);
  const onScoreRendered = useCallback((container: HTMLDivElement, visual: VisualObj) => (
    attachGuitarChordDiagrams(container, visual as unknown as GuitarParsedTune, score, open)
  ), [score, open]);
  const prepareAudio = useCallback((visual: VisualObj): VisualObj => {
    const tune = visual as unknown as GuitarParsedTune;
    const projected = Object.create(visual) as GuitarParsedTune;
    projected.setUpAudio = (options) => {
      const result = realizeGuitarChordAudio(tune.setUpAudio({ ...options, chordsOff: true }), score, options);
      if (!score.guitarVoiceIndices.length) {
        const track = result.tracks.at(-1);
        track?.forEach((event) => { if (event.volume !== undefined) event.volume *= chordVolume / 100; });
      }
      return result;
    };
    return projected as unknown as VisualObj;
  }, [score, chordVolume]);
  const listen = async (shape: GuitarChordShape) => {
    stopAudition();
    claimPlayback(auditionId);
    const version = auditionVersion.current;
    setAuditionError("");
    setListeningId(shape.id);
    try {
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
      await context.resume();
      if (version !== auditionVersion.current) return;
      const synth = new abcjs.synth.CreateSynth();
      auditionRef.current = synth;
      await synth.init({ visualObj: abcjs.parseOnly(guitarShapeAuditionAbc(shape))[0], audioContext: context,
        options: { chordsOff: true, onEnded: () => { if (version === auditionVersion.current) { setListeningId(null); releasePlayback(auditionId); } } } });
      await synth.prime();
      if (version !== auditionVersion.current) return;
      synth.start();
    } catch {
      if (version !== auditionVersion.current) return;
      setListeningId(null);
      setAuditionError("Could not load the guitar sound. Try Listen again.");
      releasePlayback(auditionId);
    }
  };
  const choose = (shape: GuitarChordShape) => {
    if (!selected) return;
    stopAudition();
    releasePlayback(auditionId);
    const targets = applyAll ? score.occurrences.filter((occurrence) => occurrence.normalizedSymbol === selected.normalizedSymbol) : [selected];
    const ids = new Set(targets.map((occurrence) => occurrence.id));
    const retained = overrides.filter((override) => !(override.instrument === "guitar-classic" && override.sourceRevisionId === score.sourceRevisionId
      && override.windowRange.scope === "chord-window" && ids.has(override.windowRange.chordWindowId ?? "")));
    onOverridesChange([...retained, ...targets.map((occurrence) => createGuitarChordOverride(score, occurrence, shape))]);
  };
  return <>
    <AbcjsPlaybackController {...props} synthOptions={GUITAR_SYNTH_OPTIONS} prepareAudio={prepareAudio} onScoreRendered={onScoreRendered} />
    {score.occurrences.length > 0 && <p className="px-4 py-2 text-xs text-zinc-500">Click a chord name or diagram to choose a guitar shape. Playback follows the selected strings and frets.</p>}
    <dialog ref={dialogRef} onCancel={close} onClose={close} className={styles.dialog} aria-labelledby={`guitar-picker-${auditionId}`}>
      {selected && <>
        <div className="flex items-start justify-between gap-4">
          <div><h2 id={`guitar-picker-${auditionId}`} className="text-xl font-semibold">{selected.symbol} · Guitar shapes</h2><p className="mt-1 text-sm text-zinc-500">Measure {selected.measureIndex + 1}, beat {selected.beat} · Standard tuning E A D G B E</p></div>
          <button type="button" onClick={close} className="rounded border px-3 py-1.5" aria-label="Close guitar shapes">Close</button>
        </div>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm">Show <select value={filter} onChange={(event) => setFilter(event.target.value)} className="ml-2 rounded border p-1.5"><option value="all">All shapes</option><option value="open">Open shapes</option><option value="barre">Barre shapes</option></select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={applyAll} onChange={(event) => setApplyAll(event.target.checked)} />Apply to every {selected.symbol} in this score</label>
        </div>
        {auditionError && <p role="alert" className="mb-3 text-sm text-red-700">{auditionError}</p>}
        <div className={styles.grid}>
          {selected.shapes.filter((shape) => filter === "all" || (filter === "barre" ? Boolean(shape.barre) : shape.frets.includes(0) && !shape.barre)).map((shape) => {
            const current = selected.selected?.id === shape.id;
            return <div key={shape.id} className={styles.card} data-selected={current}>
              <div className="text-sm font-medium">{shape.label}</div>
              <svg role="img" aria-label={`${selected.symbol}: ${shape.frets.join(" ")}`} viewBox="0 0 84 88" className="mx-auto my-2 h-32" dangerouslySetInnerHTML={{ __html: guitarDiagramMarkup(shape) }} />
              <p className="text-center font-mono text-xs">{shape.frets.join("–")}</p>
              <p className="mt-1 text-center text-[10px] text-zinc-500">{shape.midi.map((pitch) => {
                const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
                return names[pitch % 12] + (Math.floor(pitch / 12) - 1);
              }).join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void listen(shape)} className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs">{listeningId === shape.id ? "Playing…" : "Listen"}</button>
                <button type="button" onClick={() => choose(shape)} aria-pressed={current} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">{current ? "Selected" : "Use shape"}</button>
              </div>
            </div>;
          })}
        </div>
        {!selected.shapes.length && <p className="py-6 text-sm">No verified guitar shape is available for this chord yet.</p>}
        <p className="mt-4 text-xs text-zinc-500">× = muted string · ○ = open string · Numbers on dots = fingers. Your choice is saved with the project.</p>
      </>}
    </dialog>
  </>;
}
