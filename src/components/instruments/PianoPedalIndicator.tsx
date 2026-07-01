"use client";

import type { PianoPedalAutomation, PianoPedalEvent } from "@/lib/theory/piano-accompaniment";

export type PianoPedalDisplayState = "up" | "down" | "hold" | "flush";

export interface PianoPedalIndicatorProps {
  title?: string;
  pedalAutomation: PianoPedalAutomation;
  currentMeasureIndex?: number;
  currentBeat?: number;
  className?: string;
}

export interface ActivePianoPedalState {
  state: PianoPedalDisplayState;
  value: 0 | 127;
  event?: PianoPedalEvent;
}

function formatBeat(beat: number) {
  return Number.isInteger(beat) ? beat.toString() : beat.toFixed(1);
}

function eventIsAtCursor(event: PianoPedalEvent, measureIndex: number, beat: number): boolean {
  return event.measureIndex === measureIndex && Math.abs(event.beat - beat) < 0.001;
}

function eventIsBeforeCursor(event: PianoPedalEvent, measureIndex: number, beat: number): boolean {
  return event.measureIndex < measureIndex || (event.measureIndex === measureIndex && event.beat <= beat);
}

function sortPedalEvents(events: PianoPedalEvent[]): PianoPedalEvent[] {
  return [...events].sort((a, b) => a.measureIndex - b.measureIndex || a.beat - b.beat);
}

export function getActivePianoPedalState(
  events: PianoPedalEvent[],
  currentMeasureIndex = 0,
  currentBeat = 1
): ActivePianoPedalState {
  const sortedEvents = sortPedalEvents(events);
  const exactEvents = sortedEvents.filter((event) => eventIsAtCursor(event, currentMeasureIndex, currentBeat));
  const exactFlush = exactEvents.find((event) => event.type === "pedal-flush");
  if (exactFlush) return { state: "flush", value: exactFlush.value, event: exactFlush };

  const exactDown = exactEvents.find((event) => event.type === "pedal-down");
  if (exactDown) return { state: "down", value: exactDown.value, event: exactDown };

  const exactUp = exactEvents.find((event) => event.type === "pedal-up");
  if (exactUp) return { state: "up", value: exactUp.value, event: exactUp };

  const previousEvent = sortedEvents.filter((event) => eventIsBeforeCursor(event, currentMeasureIndex, currentBeat)).at(-1);
  if (previousEvent?.type === "pedal-down") {
    return { state: "hold", value: previousEvent.value, event: previousEvent };
  }

  return { state: "up", value: 0, event: previousEvent };
}

function getStateLabel(state: PianoPedalDisplayState): string {
  if (state === "flush") return "Pedal flush";
  if (state === "down") return "Pedal down";
  if (state === "hold") return "Pedal hold";
  return "Pedal up";
}

function getStateClass(state: PianoPedalDisplayState): string {
  if (state === "flush") return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200";
  if (state === "down") return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200";
  if (state === "hold") return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200";
  return "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export default function PianoPedalIndicator({
  title = "Pedal Automation",
  pedalAutomation,
  currentMeasureIndex = 0,
  currentBeat = 1,
  className = "",
}: PianoPedalIndicatorProps) {
  const activeState = getActivePianoPedalState(pedalAutomation.events, currentMeasureIndex, currentBeat);

  return (
    <section
      aria-label={`${title} pedal indicator panel`}
      className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            MIDI CC {pedalAutomation.controller.midiControlChange} · down {pedalAutomation.controller.downValue} · up {pedalAutomation.controller.upValue}
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm font-black ${getStateClass(activeState.state)}`} aria-live="polite">
          <span>{getStateLabel(activeState.state)}</span>
          <span className="ml-2 font-mono">CC64 value {activeState.value}</span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <svg role="img" aria-label={`${title} real-time sustain pedal graphic`} viewBox="0 0 260 92" className="h-24 w-full text-zinc-900 dark:text-zinc-100">
          <rect x="22" y="32" width="216" height="42" rx="20" className="fill-zinc-200 stroke-zinc-400 dark:fill-zinc-800 dark:stroke-zinc-600" />
          <rect
            x="52"
            y={activeState.value === 127 ? "48" : "26"}
            width="156"
            height="22"
            rx="11"
            className={activeState.state === "flush" ? "fill-rose-400" : activeState.value === 127 ? "fill-emerald-400" : "fill-zinc-400"}
          />
          <text x="130" y="86" textAnchor="middle" className="fill-current text-[11px] font-bold">
            M{currentMeasureIndex + 1} beat {formatBeat(currentBeat)}
          </text>
        </svg>
      </div>

      <ol className="mt-4 space-y-2 text-xs font-mono text-zinc-600 dark:text-zinc-300">
        {sortPedalEvents(pedalAutomation.events).map((event, index) => (
          <li key={`${event.measureIndex}-${event.beat}-${event.type}-${index}`} className="rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
            M{event.measureIndex + 1} beat {formatBeat(event.beat)} · {event.type} · {event.chord} · CC64 {event.value}
            {event.previousChord ? ` · changes from ${event.previousChord}` : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}
