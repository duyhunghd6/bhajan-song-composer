"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import AbcjsPlaybackController from "@/components/music-sheet/AbcjsPlaybackController";

const DEFAULT_STORAGE_KEY = "bhajan-song-composer:abc-editor:draft";
const MAX_HISTORY = 100;

export const DEFAULT_ABC = `X:1
T:New Bhajan Arrangement
M:4/4
L:1/8
Q:1/4=120
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`;

type EditorHistory = {
  past: string[];
  present: string;
  future: string[];
};

interface AbcEditorProps {
  initialAbc?: string;
  storageKey?: string;
  title?: string;
  value?: string;
  onChange?: (abc: string) => void;
}

export default function AbcEditor({
  initialAbc = DEFAULT_ABC,
  storageKey = DEFAULT_STORAGE_KEY,
  title = "ABC Notation Editor",
  value,
  onChange,
}: AbcEditorProps) {
  const [history, setHistory] = useState<EditorHistory>({
    past: [],
    present: value ?? initialAbc,
    future: [],
  });
  const [storageStatus, setStorageStatus] = useState("Draft saves locally in this browser.");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const previewRenderOptions = useMemo(
    () => ({
      staffwidth: 720,
      wrap: {
        minSpacing: 1.7,
        maxSpacing: 2.5,
        preferredMeasuresPerLine: 4,
        lastLineLimit: 0.6,
      },
      paddingright: 32,
    }),
    []
  );

  useEffect(() => {
    if (value === undefined) return;

    const timeoutId = window.setTimeout(() => {
      setHistory((current) => {
        if (current.present === value) return current;

        return {
          past: [...current.past, current.present].slice(-MAX_HISTORY),
          present: value,
          future: [],
        };
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        const savedDraft = window.localStorage.getItem(storageKey);
        if (savedDraft) {
          setHistory({ past: [], present: savedDraft, future: [] });
          setStorageStatus("Loaded a saved draft from this browser.");
          onChange?.(savedDraft);
        }
      } catch (err) {
        console.error("Error loading ABC editor draft:", err);
        setStorageStatus("Local draft loading is unavailable in this browser.");
      } finally {
        setHasLoadedStorage(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [storageKey, onChange]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, history.present);
        setStorageStatus("Draft saved locally in this browser.");
      } catch (err) {
        console.error("Error saving ABC editor draft:", err);
        setStorageStatus("Local draft saving is unavailable in this browser.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasLoadedStorage, history.present, storageKey]);

  const commitText = useCallback((nextText: string) => {
    setHistory((current) => {
      if (nextText === current.present) return current;

      return {
        past: [...current.past, current.present].slice(-MAX_HISTORY),
        present: nextText,
        future: [],
      };
    });
    onChange?.(nextText);
  }, [onChange]);

  const undo = useCallback(() => {
    if (history.past.length === 0) return;

    const previous = history.past[history.past.length - 1];
    setHistory((current) => {
      if (current.past.length === 0) return current;

      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, MAX_HISTORY),
      };
    });
    onChange?.(previous);
  }, [history.past, onChange]);

  const redo = useCallback(() => {
    if (history.future.length === 0) return;

    const next = history.future[0];
    setHistory((current) => {
      if (current.future.length === 0) return current;

      return {
        past: [...current.past, current.present].slice(-MAX_HISTORY),
        present: next,
        future: current.future.slice(1),
      };
    });
    onChange?.(next);
  }, [history.future, onChange]);

  const resetToSample = () => {
    commitText(initialAbc);
  };

  const clearSavedDraft = () => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(storageKey);
      setStorageStatus("Saved draft cleared. Refresh to return to the sample notation.");
    } catch (err) {
      console.error("Error clearing ABC editor draft:", err);
      setStorageStatus("Could not clear the saved draft in this browser.");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const isModifierPressed = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (!isModifierPressed) return;

    if (key === "z" && event.shiftKey) {
      event.preventDefault();
      redo();
      return;
    }

    if (key === "z") {
      event.preventDefault();
      undo();
      return;
    }

    if (key === "y") {
      event.preventDefault();
      redo();
    }
  };

  return (
    <section className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-md overflow-hidden">
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-5">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Type ABC notation and preview the rendered staff in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="abc-editor-undo"
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Undo
          </button>
          <button
            id="abc-editor-redo"
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Redo
          </button>
          <button
            id="abc-editor-reset-sample"
            type="button"
            onClick={resetToSample}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
          >
            Reset sample
          </button>
          <button
            id="abc-editor-clear-draft"
            type="button"
            onClick={clearSavedDraft}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
          >
            Clear draft
          </button>
        </div>
      </div>

      <div className="abc-editor-responsive-grid">
        <div className="abc-editor-source-panel min-w-0 space-y-3 border-b border-zinc-100 p-5 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="abc-editor-input"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              ABC source
            </label>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Cmd/Ctrl+Z undo · Cmd/Ctrl+Shift+Z redo
            </span>
          </div>
          <textarea
            id="abc-editor-input"
            value={history.present}
            onChange={(event) => commitText(event.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="abc-editor-textarea min-h-[420px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 font-mono text-sm leading-6 text-zinc-900 shadow-inner placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100"
            placeholder="X:1&#10;T:My Bhajan&#10;M:4/4&#10;K:C&#10;C D E F | G A B c |"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{storageStatus}</p>
        </div>

        <div className="min-w-0 space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Music Sheet (ABCJS rendering)
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Bounded preview
            </span>
          </div>

          <AbcjsPlaybackController
            abcString={history.present}
            title="Editor Music Sheet Preview"
            canvasId="abc-editor-preview"
            minWidthClassName="min-w-[520px] max-w-[760px]"
            sheetViewportClassName="max-h-[min(72vh,780px)] overflow-auto p-4"
            renderOptions={previewRenderOptions}
          />
        </div>
      </div>
    </section>
  );
}
