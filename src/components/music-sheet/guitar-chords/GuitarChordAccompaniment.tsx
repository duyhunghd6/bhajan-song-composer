"use client";

import { Button } from "@/components/ui/Button";


import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import abcjs from "abcjs";
import { createPortal } from "react-dom";
import styles from "./guitar-chords.module.css";
import AbcjsPlaybackController from "../AbcjsPlaybackController";
import type { AbcjsPlaybackControllerProps, VisualObj } from "../abcjs-playback/types";
import { claimPlayback, registerPlayback, releasePlayback, unregisterPlayback } from "../playback-registry";
import {
  buildGuitarChordScore, createGuitarChordOverride, guitarShapeAuditionAbc, realizeGuitarChordAudio,
  type GuitarChordShape, type GuitarParsedTune, type GuitarChordOccurrence,
} from "@/lib/theory/guitar-chord-score";
import type { VoicingOverride } from "@/lib/theory/voicing-override";
import { attachGuitarChordDiagrams, guitarDiagramMarkup } from "./diagram";

interface Props extends AbcjsPlaybackControllerProps {
  sourceAbc: string;
  overrides: VoicingOverride[];
  onOverridesChange: (overrides: VoicingOverride[]) => void;
  chordVolume?: number;
  /** Written strumming events already contain the selected shape and rhythm. */
  writtenAccompaniment?: boolean;
  /** Independent chord playback can use hidden chord cues from the source. */
  chordAudioAbc?: string;
  chordAudioEnabled?: boolean;
  onChordEdit?: (occurrence: GuitarChordOccurrence, symbol: string | null) => void;
}

export default function GuitarChordAccompaniment({ sourceAbc, overrides, onOverridesChange, chordVolume = 100, writtenAccompaniment = false, chordAudioAbc, chordAudioEnabled, synthOptions, onChordEdit, ...props }: Props) {
  const guitarSynthOptions = useMemo(() => ({ ...synthOptions, chordsOff: true }), [synthOptions]);
  const score = useMemo(() => buildGuitarChordScore(props.abcString, sourceAbc, overrides), [props.abcString, sourceAbc, overrides]);
  const audioScore = useMemo(() => chordAudioAbc === undefined ? score
    : { ...buildGuitarChordScore(chordAudioAbc, sourceAbc, overrides), guitarVoiceIndices: [] },
  [chordAudioAbc, score, sourceAbc, overrides]);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextChord = score.occurrences.find((item) => item.id === contextMenu?.id);
  useEffect(() => {
    if (!contextMenu) return;
    const opener = document.querySelector<SVGElement>(`[data-guitar-chord="${CSS.escape(contextMenu.id)}"]`);
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setContextMenu(null); };
    window.addEventListener("pointerdown", dismiss);
    return () => { window.removeEventListener("pointerdown", dismiss); opener?.focus({ preventScroll: true }); };
  }, [contextMenu]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingShape, setPendingShape] = useState<GuitarChordShape | null>(null);
  const [chordSymbol, setChordSymbol] = useState("");
  const [filter, setFilter] = useState("all");
  const [auditionError, setAuditionError] = useState("");
  const [listeningId, setListeningId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
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
  const open = useCallback((id: string) => { setPendingShape(null); setFilter("all"); setChordSymbol(score.occurrences.find((item) => item.id === id)?.symbol ?? ""); setSelectedId(id); }, [score]);
  const onScoreRendered = useCallback((container: HTMLDivElement, visual: VisualObj) => (
    attachGuitarChordDiagrams(container, visual as unknown as GuitarParsedTune, score, open, (id, x, y) => setContextMenu({ id, x, y }))
  ), [score, open]);
  const prepareAudio = useCallback((visual: VisualObj): VisualObj => {
    const tune = visual as unknown as GuitarParsedTune;
    const projected = Object.create(visual) as GuitarParsedTune;
    projected.setUpAudio = (options) => {
      const base = tune.setUpAudio({ ...options, chordsOff: true });
      if (!(chordAudioEnabled ?? !writtenAccompaniment)) return base;
      const result = realizeGuitarChordAudio(base, audioScore, options);
      if (!audioScore.guitarVoiceIndices.length) {
        const track = result.tracks.at(-1);
        track?.forEach((event) => { if (event.volume !== undefined) event.volume *= chordVolume / 100; });
      }
      return result;
    };
    return projected as unknown as VisualObj;
  }, [audioScore, chordVolume, writtenAccompaniment, chordAudioEnabled]);
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
  const choose = (shape: GuitarChordShape, applyAll = false) => {
    if (!selected) return;
    stopAudition();
    releasePlayback(auditionId);
    const targets = applyAll ? score.occurrences.filter((occurrence) => occurrence.normalizedSymbol === selected.normalizedSymbol) : [selected];
    const ids = new Set(targets.map((occurrence) => occurrence.id));
    const retained = overrides.filter((override) => !(override.instrument === "guitar-classic" && override.sourceRevisionId === score.sourceRevisionId
      && override.windowRange.scope === "chord-window" && ids.has(override.windowRange.chordWindowId ?? "")));
    onOverridesChange([...retained, ...targets.map((occurrence) => createGuitarChordOverride(score, occurrence, shape))]);
    close();
  };
  return <>
    <AbcjsPlaybackController {...props} scoreActionsPlacement="footer" synthOptions={guitarSynthOptions} prepareAudio={prepareAudio} onScoreRendered={onScoreRendered} />
    {contextMenu && contextChord && createPortal(<div ref={menuRef} role="menu" aria-label={`${contextChord.symbol} chord actions`} tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); setContextMenu(null); return; }
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const index = event.key === "ArrowDown" ? (current + 1) % items.length : event.key === "ArrowUp" ? (current - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
        if (index >= 0) { event.preventDefault(); items[index]?.focus(); }
        if (event.key === "Tab") setContextMenu(null);
      }}
      className="fixed z-[1200] flex min-w-48 flex-col gap-1 rounded-lg border bg-white p-2 shadow-xl dark:bg-zinc-900"
      style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 230)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 220)) }}>
      <p className="px-2 py-1 text-sm font-semibold">{contextChord.symbol} · Measure {contextChord.measureIndex + 1}</p>
      {contextChord.selected && <Button type="button" role="menuitem" onClick={() => { void listen(contextChord.selected!); setContextMenu(null); }}>Audition chord</Button>}
      <Button type="button" role="menuitem" onClick={() => { open(contextChord.id); setContextMenu(null); }}>Select voicing</Button>
      {onChordEdit && <>
        <Button type="button" role="menuitem" onClick={() => { open(contextChord.id); setContextMenu(null); }}>Change chord symbol</Button>
        <Button type="button" role="menuitem" variant="danger" onClick={() => { onChordEdit(contextChord, null); setContextMenu(null); }}>Remove chord</Button>
      </>}
    </div>, document.body)}
    <dialog ref={dialogRef} onCancel={close} onClose={close} className={styles.dialog}
      onPointerDown={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        backdropPress.current = event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
      }}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        if (backdropPress.current && event.target === event.currentTarget && outside) close();
        backdropPress.current = false;
      }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key === "Enter" && pendingShape && event.target === event.currentTarget) { event.preventDefault(); choose(pendingShape); }
    }} aria-labelledby={`guitar-picker-${auditionId}`}>
      {selected && <>
        <div className="flex items-start justify-between gap-4">
          <div><h2 id={`guitar-picker-${auditionId}`} className="text-xl font-semibold">{selected.symbol} · Guitar shapes</h2><p className="mt-1 text-sm text-zinc-500">Measure {selected.measureIndex + 1}, beat {selected.beat} · Standard tuning E A D G B E</p></div>
          <Button variant="ghost" size="sm" type="button" onClick={close}  aria-label="Close guitar shapes">Esc</Button>
        </div>
        {onChordEdit && <div className="my-4 flex flex-wrap items-center gap-2" aria-label="Chord actions">
          <label>Chord symbol <input aria-label="Chord symbol" className="ml-2 rounded border p-2" value={chordSymbol} onChange={(event) => setChordSymbol(event.target.value)} /></label>
          <Button type="button" onClick={() => { onChordEdit(selected, chordSymbol); close(); }}>Change chord</Button>
          <Button type="button" variant="danger" onClick={() => { onChordEdit(selected, null); close(); }}>Remove chord</Button>
          {selected.selected && <Button type="button" onClick={() => void listen(selected.selected!)}>Audition chord</Button>}
        </div>}
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm">Show <select value={filter} onChange={(event) => setFilter(event.target.value)} className="ml-2 rounded border p-1.5"><option value="all">All shapes</option><option value="open">Open shapes</option><option value="barre">Barre shapes</option></select></label>
          <Button variant="primary" size="md" type="button" disabled={!pendingShape} onClick={() => pendingShape && choose(pendingShape, true)} >Apply to every {selected.symbol} in this score</Button>
        </div>
        {auditionError && <p role="alert" className="mb-3 text-sm text-red-700">{auditionError}</p>}
        <div className={styles.grid} role="radiogroup" aria-label="Guitar chord shape">
          {selected.shapes.filter((shape) => filter === "all" || (filter === "barre" ? Boolean(shape.barre) : shape.frets.includes(0) && !shape.barre)).map((shape) => {
            const current = (pendingShape ?? selected.selected)?.id === shape.id;
            return <div key={shape.id} className={styles.card} data-selected={current}
              role="radio" aria-checked={current} aria-label={`${selected.symbol}: ${shape.frets.join(" ")}`} tabIndex={0}
              onClick={(event) => { setPendingShape(shape); event.currentTarget.focus(); }} onDoubleClick={() => choose(shape)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter") { event.preventDefault(); choose(shape); }
                if (event.key === " ") { event.preventDefault(); setPendingShape(shape); }
              }}>
              <div className="text-sm font-medium">{shape.label}</div>
              <svg role="img" aria-label={`${selected.symbol}: ${shape.frets.join(" ")}`} viewBox="0 0 84 88" className="mx-auto my-2 h-24" dangerouslySetInnerHTML={{ __html: guitarDiagramMarkup(shape) }} />
              <p className="text-center font-mono text-xs">{shape.frets.join("–")}</p>
              <p className="mt-1 text-center text-[10px] text-zinc-500">{shape.midi.map((pitch) => {
                const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
                return names[pitch % 12] + (Math.floor(pitch / 12) - 1);
              }).join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" iconOnly type="button" onClick={(event) => { event.stopPropagation(); void listen(shape); }}
                  onDoubleClick={(event) => event.stopPropagation()} aria-label={`Listen to ${selected.symbol}: ${shape.frets.join(" ")}`}
                  aria-pressed={listeningId === shape.id} className="mx-auto">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
                  </svg>
                </Button>
              </div>
            </div>;
          })}
        </div>
        {!selected.shapes.length && <p className="py-6 text-sm">No verified guitar shape is available for this chord yet.</p>}
        <p className="mt-4 text-xs text-zinc-500">Click a shape, then press Enter or double-click to save. Esc closes. × = muted · ○ = open · Dot numbers = fingers.</p>
      </>}
    </dialog>
  </>;
}
