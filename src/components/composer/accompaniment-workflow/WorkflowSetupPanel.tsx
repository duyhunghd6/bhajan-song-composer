import { useMemo, useState } from "react";

import {
  ACCOMPANIMENT_INSTRUMENT_LABELS,
  ACCOMPANIMENT_STYLE_LABELS,
  defaultInstrumentRoleNote,
  getEnabledAccompanimentWorkflowStepIds,
  normalizeAccompanimentWorkflowSetup,
  orderedAccompanimentInstruments,
  type AccompanimentInstrumentId,
  type AccompanimentStyleId,
  type AccompanimentWorkflowSetup,
} from "@/lib/theory/accompaniment-workflow";

interface WorkflowSetupPanelProps {
  setup: AccompanimentWorkflowSetup;
  sessionSetup?: AccompanimentWorkflowSetup | null;
  disabled?: boolean;
  onSetupChange: (setup: AccompanimentWorkflowSetup) => void;
  onResetWithSetup?: () => void;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function setupFingerprint(setup: AccompanimentWorkflowSetup): string {
  const normalized = normalizeAccompanimentWorkflowSetup(setup);
  return JSON.stringify({
    style: normalized.style,
    instruments: orderedAccompanimentInstruments(normalized).map((instrument) => ({
      id: instrument.id,
      enabled: instrument.enabled,
      order: instrument.order,
    })),
  });
}

function withReorderedRoleNotes(setup: AccompanimentWorkflowSetup): AccompanimentWorkflowSetup {
  const ordered = orderedAccompanimentInstruments(setup);
  return {
    ...setup,
    instruments: ordered.map((instrument, order) => ({
      ...instrument,
      order,
      roleNote: defaultInstrumentRoleNote(instrument.id, order, ordered.length),
    })),
  };
}

export default function WorkflowSetupPanel({
  setup,
  sessionSetup,
  disabled = false,
  onSetupChange,
  onResetWithSetup,
}: WorkflowSetupPanelProps) {
  const normalizedSetup = useMemo(() => normalizeAccompanimentWorkflowSetup(setup), [setup]);
  const ordered = orderedAccompanimentInstruments(normalizedSetup);
  const enabledStepCount = getEnabledAccompanimentWorkflowStepIds(normalizedSetup).length;
  const [draggedId, setDraggedId] = useState<AccompanimentInstrumentId | null>(null);
  const setupChangedFromSession = Boolean(
    sessionSetup && setupFingerprint(sessionSetup) !== setupFingerprint(normalizedSetup)
  );

  const updateStyle = (style: AccompanimentStyleId) => {
    onSetupChange({ ...normalizedSetup, style });
  };

  const updateInstrumentEnabled = (id: AccompanimentInstrumentId) => {
    onSetupChange({
      ...normalizedSetup,
      instruments: ordered.map((instrument) => instrument.id === id
        ? { ...instrument, enabled: !instrument.enabled }
        : instrument),
    });
  };

  const reorder = (fromIndex: number, toIndex: number) => {
    onSetupChange(withReorderedRoleNotes({
      ...normalizedSetup,
      instruments: moveItem(ordered, fromIndex, toIndex),
    }));
  };

  return (
    <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Accompaniment setup</h3>
        </div>
        <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-bold text-amber-700 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-300">
          {enabledStepCount} enabled workflow steps
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(["solo-fingerstyle", "accompaniment"] as const).map((style) => (
          <button
            key={style}
            type="button"
            disabled={disabled}
            onClick={() => updateStyle(style)}
            className={`rounded-xl border py-2 px-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${normalizedSetup.style === style
              ? "border-amber-400 bg-white shadow-sm dark:bg-amber-950/40"
              : "border-zinc-200 bg-white/70 hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-950/50"}`}
          >
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{ACCOMPANIMENT_STYLE_LABELS[style]}</p>
          </button>
        ))}
      </div>

      <ol className="space-y-1.5">
        {ordered.map((instrument, index) => (
          <li
            key={instrument.id}
            draggable={!disabled}
            onDragStart={() => setDraggedId(instrument.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const fromIndex = ordered.findIndex((candidate) => candidate.id === draggedId);
              reorder(fromIndex, index);
              setDraggedId(null);
            }}
            onDragEnd={() => setDraggedId(null)}
            className={`rounded-xl border bg-white py-1.5 px-3 dark:bg-zinc-950/60 ${instrument.enabled ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-200 opacity-60 dark:border-zinc-800"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={instrument.enabled}
                  onChange={() => updateInstrumentEnabled(instrument.id)}
                  className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="min-w-0 text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {index + 1}. {ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]}
                </span>
              </label>
              <div className="flex items-center gap-1">
                <span className="hidden cursor-grab select-none rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-500 dark:border-zinc-800 sm:inline" aria-hidden="true">↕</span>
                <button type="button" disabled={disabled || index === 0} onClick={() => reorder(index, index - 1)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-bold text-zinc-600 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300">↑</button>
                <button type="button" disabled={disabled || index === ordered.length - 1} onClick={() => reorder(index, index + 1)} className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-bold text-zinc-600 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300">↓</button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {setupChangedFromSession && onResetWithSetup && (
        <div className="rounded-xl border border-amber-300 bg-white p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-300">
          <p className="font-semibold">Setup changed after this workflow started.</p>
          <p className="mt-1 leading-5">Existing decisions are preserved until you reset, so generated steps do not silently change underneath you.</p>
          <button type="button" onClick={onResetWithSetup} className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600">
            Reset workflow with this setup
          </button>
        </div>
      )}
    </section>
  );
}
