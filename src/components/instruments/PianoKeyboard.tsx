"use client";

import { useState } from "react";
import { normalizeAbcNote } from "@/lib/theory/melody-analyzer";
import SvgHandsOverlay, { type SvgHandFingeringEvent } from "./SvgHandsOverlay";
import { getNoteValue } from "@/lib/theory/scales";

const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_NOTES_BY_WHITE: Partial<Record<string, string>> = {
  C: "C#",
  D: "D#",
  F: "F#",
  G: "G#",
  A: "A#",
};

const WHITE_KEY_WIDTH = 36;
const WHITE_KEY_HEIGHT = 144;
const BLACK_KEY_WIDTH = 22;
const BLACK_KEY_HEIGHT = 92;
const LABEL_AREA_HEIGHT = 34;

type PianoHand = "left" | "right";
export type PianoHandMode = "left" | "right" | "combined";

type PianoKeyColor = "white" | "black";

export interface PianoHighlightedNote {
  /** Note name such as C, F#, Bb4, or ABC-style ^F. Octave is optional. */
  note: string;
  finger?: number | string;
  hand?: PianoHand;
  label?: string;
}

export interface PianoKeyInfo {
  id: string;
  note: string;
  octave: number;
  pitchClass: string;
  color: PianoKeyColor;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedPianoNote {
  pitchClass: string;
  octave?: number;
}

export interface PianoKeyboardProps {
  title?: string;
  subtitle?: string;
  startOctave?: number;
  octaveCount?: number;
  highlights?: PianoHighlightedNote[];
  handOverlayEvents?: SvgHandFingeringEvent[];
  handMode?: PianoHandMode;
  onHandModeChange?: (handMode: PianoHandMode) => void;
  className?: string;
}

export function normalizePianoNote(note: string): NormalizedPianoNote {
  const trimmed = note.trim();
  const octaveMatch = trimmed.match(/(-?\d+)$/);
  const octave = octaveMatch ? Number(octaveMatch[1]) : undefined;
  const noteWithoutOctave = octaveMatch ? trimmed.slice(0, octaveMatch.index) : trimmed;
  const pitchClass = normalizeAbcNote(noteWithoutOctave);

  if (getNoteValue(pitchClass) === undefined) {
    throw new Error(`Invalid piano note: ${note}`);
  }

  return { pitchClass, octave };
}

export function buildPianoKeys(startOctave = 3, octaveCount = 2): PianoKeyInfo[] {
  const firstOctave = Math.floor(startOctave);
  const octaves = Math.max(1, Math.floor(octaveCount));
  const keys: PianoKeyInfo[] = [];
  let whiteKeyIndex = 0;

  for (let octaveOffset = 0; octaveOffset < octaves; octaveOffset++) {
    const octave = firstOctave + octaveOffset;

    for (const whiteNote of WHITE_NOTES) {
      const whiteX = whiteKeyIndex * WHITE_KEY_WIDTH;
      keys.push({
        id: `${whiteNote}${octave}`,
        note: `${whiteNote}${octave}`,
        octave,
        pitchClass: whiteNote,
        color: "white",
        x: whiteX,
        y: 0,
        width: WHITE_KEY_WIDTH,
        height: WHITE_KEY_HEIGHT,
      });

      const blackNote = BLACK_NOTES_BY_WHITE[whiteNote];
      if (blackNote) {
        keys.push({
          id: `${blackNote}${octave}`,
          note: `${blackNote}${octave}`,
          octave,
          pitchClass: blackNote,
          color: "black",
          x: whiteX + WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2,
          y: 0,
          width: BLACK_KEY_WIDTH,
          height: BLACK_KEY_HEIGHT,
        });
      }

      whiteKeyIndex += 1;
    }
  }

  return keys;
}

export function findPianoHighlight(
  key: PianoKeyInfo,
  highlights: PianoHighlightedNote[]
): PianoHighlightedNote | undefined {
  return highlights.find((highlight) => {
    const normalized = normalizePianoNote(highlight.note);
    const pitchMatches = normalized.pitchClass === key.pitchClass;
    const octaveMatches = normalized.octave === undefined || normalized.octave === key.octave;
    return pitchMatches && octaveMatches;
  });
}

function handMatchesMode(hand: PianoHand | undefined, handMode: PianoHandMode): boolean {
  return handMode === "combined" || hand === undefined || hand === handMode;
}

function getVisibleHighlights(
  highlights: PianoHighlightedNote[],
  handMode: PianoHandMode
): PianoHighlightedNote[] {
  return highlights.filter((highlight) => handMatchesMode(highlight.hand, handMode));
}

function getVisibleHandEvents(
  events: SvgHandFingeringEvent[],
  handMode: PianoHandMode
): SvgHandFingeringEvent[] {
  if (handMode === "combined") return events;
  return events.filter((event) => event.hand === handMode);
}

function getWhiteHighlightClass(highlight: PianoHighlightedNote): string {
  if (highlight.hand === "left") {
    return "fill-sky-200 stroke-sky-500 dark:fill-sky-500/40 dark:stroke-sky-300";
  }

  if (highlight.hand === "right") {
    return "fill-amber-200 stroke-amber-500 dark:fill-amber-500/40 dark:stroke-amber-300";
  }

  return "fill-emerald-200 stroke-emerald-500 dark:fill-emerald-500/40 dark:stroke-emerald-300";
}

function getBlackHighlightClass(highlight: PianoHighlightedNote): string {
  if (highlight.hand === "left") {
    return "fill-sky-500 stroke-sky-700 dark:stroke-sky-300";
  }

  if (highlight.hand === "right") {
    return "fill-amber-500 stroke-amber-700 dark:stroke-amber-300";
  }

  return "fill-emerald-500 stroke-emerald-700 dark:stroke-emerald-300";
}

function getHighlightLabelClass(highlight: PianoHighlightedNote): string {
  if (highlight.hand === "left") return "fill-sky-950 text-[12px] font-bold dark:fill-sky-100";
  if (highlight.hand === "right") return "fill-amber-950 text-[12px] font-bold dark:fill-amber-100";
  return "fill-emerald-950 text-[12px] font-bold dark:fill-emerald-100";
}

function getHighlightLabel(highlight: PianoHighlightedNote): string {
  if (highlight.label) return highlight.label;
  if (highlight.finger) return String(highlight.finger);
  if (highlight.hand === "left") return "L";
  if (highlight.hand === "right") return "R";
  return "•";
}

export default function PianoKeyboard({
  title = "Piano voicing",
  subtitle,
  startOctave = 3,
  octaveCount = 2,
  highlights = [],
  handOverlayEvents = [],
  handMode,
  onHandModeChange,
  className = "",
}: PianoKeyboardProps) {
  const [uncontrolledHandMode, setUncontrolledHandMode] = useState<PianoHandMode>(handMode ?? "combined");
  const activeHandMode = handMode ?? uncontrolledHandMode;
  const keys = buildPianoKeys(startOctave, octaveCount);
  const visibleHighlights = getVisibleHighlights(highlights, activeHandMode);
  const visibleHandEvents = getVisibleHandEvents(handOverlayEvents, activeHandMode);
  const whiteKeys = keys.filter((key) => key.color === "white");
  const blackKeys = keys.filter((key) => key.color === "black");
  const width = whiteKeys.length * WHITE_KEY_WIDTH;
  const height = WHITE_KEY_HEIGHT + LABEL_AREA_HEIGHT;

  function updateHandMode(nextHandMode: PianoHandMode) {
    if (handMode === undefined) {
      setUncontrolledHandMode(nextHandMode);
    }

    onHandModeChange?.(nextHandMode);
  }

  return (
    <section
      className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <div className="mb-4 space-y-1">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
        {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Piano hand display mode">
        {[
          ["left", "Left Hand Only"],
          ["right", "Right Hand Only"],
          ["combined", "Combined Hands-Together"],
        ].map(([mode, label]) => {
          const nextHandMode = mode as PianoHandMode;
          const selected = nextHandMode === activeHandMode;

          return (
            <button
              key={nextHandMode}
              type="button"
              aria-pressed={selected}
              onClick={() => updateHandMode(nextHandMode)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                selected
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`${title} piano keyboard diagram`}
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[520px] text-zinc-900 dark:text-zinc-100"
        >
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            rx="14"
            className="fill-amber-50 stroke-amber-100 dark:fill-zinc-950 dark:stroke-zinc-800"
          />

          {whiteKeys.map((key) => {
            const highlight = findPianoHighlight(key, visibleHighlights);

            return (
              <g key={key.id}>
                <title>
                  {highlight
                    ? `${key.note} highlighted${highlight.finger ? ` with finger ${highlight.finger}` : ""}`
                    : key.note}
                </title>
                <rect
                  x={key.x + 1}
                  y="8"
                  width={key.width - 2}
                  height={key.height}
                  rx="8"
                  className={
                    highlight
                      ? getWhiteHighlightClass(highlight)
                      : "fill-white stroke-zinc-300 dark:fill-zinc-100 dark:stroke-zinc-400"
                  }
                  strokeWidth="1.5"
                />
                <text
                  x={key.x + key.width / 2}
                  y={WHITE_KEY_HEIGHT + 28}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[10px] font-semibold dark:fill-zinc-400"
                >
                  {key.note}
                </text>
                {highlight && (
                  <text
                    x={key.x + key.width / 2}
                    y={WHITE_KEY_HEIGHT - 12}
                    textAnchor="middle"
                    className={getHighlightLabelClass(highlight)}
                  >
                    {getHighlightLabel(highlight)}
                  </text>
                )}
              </g>
            );
          })}

          {blackKeys.map((key) => {
            const highlight = findPianoHighlight(key, visibleHighlights);

            return (
              <g key={key.id}>
                <title>
                  {highlight
                    ? `${key.note} highlighted${highlight.finger ? ` with finger ${highlight.finger}` : ""}`
                    : key.note}
                </title>
                <rect
                  x={key.x}
                  y="8"
                  width={key.width}
                  height={key.height}
                  rx="6"
                  className={
                    highlight
                      ? getBlackHighlightClass(highlight)
                      : "fill-zinc-900 stroke-zinc-950 dark:fill-zinc-700 dark:stroke-zinc-500"
                  }
                  strokeWidth="1.5"
                />
                {highlight && (
                  <text
                    x={key.x + key.width / 2}
                    y={key.height - 10}
                    textAnchor="middle"
                    className="fill-white text-[11px] font-bold"
                  >
                    {getHighlightLabel(highlight)}
                  </text>
                )}
              </g>
            );
          })}

          <SvgHandsOverlay title={`${title} hands`} events={visibleHandEvents} width={width} height={height} />
        </svg>
      </div>
    </section>
  );
}
