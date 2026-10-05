"use client";

import { Button } from "@/components/ui/Button";


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./workspace/studio.module.css";
import type { ReactNode } from "react";
import AbcjsPlaybackController, { type SourceRange } from "@/components/music-sheet/AbcjsPlaybackController";
import GuitarChordAccompaniment from "@/components/music-sheet/guitar-chords/GuitarChordAccompaniment";
import type { VoicingOverride } from "@/lib/theory/voicing-override";
import AbcSourceEditor, { type AbcSourceEditorHandle } from "./abc-editor/AbcSourceEditor";
import { validateAbcNotation, type AbcValidationEdit } from "@/app/actions/abc-validation";

const DEFAULT_STORAGE_KEY = "bhajan-song-composer:abc-editor:draft";

export const DEFAULT_ABC = `X:1
T:New Bhajan Arrangement
M:4/4
L:1/8
Q:1/4=120
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`;

interface AbcEditorProps {
  studio?: boolean;
  studioActions?: ReactNode;
  initialAbc?: string;
  storageKey?: string;
  manageStorage?: boolean;
  title?: string;
  value?: string;
  onChange?: (abc: string) => void;
  voicingOverrides?: VoicingOverride[];
  onVoicingOverridesChange?: (overrides: VoicingOverride[]) => void;
}

export default function AbcEditor({
  studio = false,
  studioActions,
  initialAbc = DEFAULT_ABC,
  storageKey = DEFAULT_STORAGE_KEY,
  manageStorage = true,
  title = "ABC Notation Editor",
  value,
  onChange,
  voicingOverrides,
  onVoicingOverridesChange,
}: AbcEditorProps) {
  // Undo/redo history lives in CodeMirror; this is the current text only.
  const [text, setText] = useState(value ?? initialAbc);
  const [localVoicingOverrides, setLocalVoicingOverrides] = useState<VoicingOverride[]>([]);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  // Source selection drives the score highlight; score clicks write it back.
  const [sourceSelection, setSourceSelection] = useState<SourceRange | null>(null);
  const editorRef = useRef<AbcSourceEditorHandle>(null);
  const [storageStatus, setStorageStatus] = useState(
    manageStorage ? "Draft saves locally in this browser." : "Draft persistence is managed by the Composer workspace."
  );
  const [hasLoadedStorage, setHasLoadedStorage] = useState(!manageStorage);
  const [isValidating, setIsValidating] = useState(false);
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null);
  const [validationEdits, setValidationEdits] = useState<AbcValidationEdit[] | null>(null);

  const { canUndo, canRedo } = historyState;
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

  const suggestedAbcPreview = useMemo(() => {
    if (!validationEdits) return null;
    let nextAbc = text;
    for (const edit of validationEdits) {
      if (edit.originalLines) {
        nextAbc = nextAbc.replace(edit.originalLines, edit.newLines || "");
      }
    }
    return nextAbc;
  }, [text, validationEdits]);

  useEffect(() => {
    if (value === undefined) return;

    const timeoutId = window.setTimeout(() => setText(value), 0);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  useEffect(() => {
    if (!manageStorage || typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        const savedDraft = window.localStorage.getItem(storageKey);
        if (savedDraft) {
          setText(savedDraft);
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
  }, [storageKey, onChange, manageStorage]);

  useEffect(() => {
    if (!manageStorage || !hasLoadedStorage || typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, text);
        setStorageStatus("Draft saved locally in this browser.");
      } catch (err) {
        console.error("Error saving ABC editor draft:", err);
        setStorageStatus("Local draft saving is unavailable in this browser.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasLoadedStorage, text, storageKey, manageStorage]);

  const commitText = useCallback((nextText: string) => {
    setText(nextText);
    onChange?.(nextText);
  }, [onChange]);

  const undo = () => editorRef.current?.undo();
  const redo = () => editorRef.current?.redo();

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

  const handleValidate = async () => {
    try {
      setIsValidating(true);
      setValidationFeedback(null);
      setValidationEdits(null);
      const result = await validateAbcNotation(text);
      setValidationFeedback(result.feedback);
      setValidationEdits(result.edits);
    } catch (err) {
      console.error("ABC validation failed:", err);
      setValidationFeedback("Validation failed. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const applySuggestion = () => {
    if (suggestedAbcPreview) {
      commitText(suggestedAbcPreview);
      setValidationFeedback(null);
      setValidationEdits(null);
    }
  };

  const dismissSuggestion = () => {
    setValidationFeedback(null);
    setValidationEdits(null);
  };

  return (
    <section className={studio ? styles.editor : "w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-md overflow-hidden"}>
      <div className={studio ? styles.editorToolbar : "flex flex-wrap gap-4 items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-5"}>
        <div>
          {studio ? <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Melody editor</h1> : <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>}
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {studio ? "Changes appear in your score as you type." : "Type ABC notation and preview the rendered staff in real time."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm"
            id="abc-editor-undo"
            type="button"
            onClick={undo}
            disabled={!canUndo}

          >
            Undo
          </Button>
          <Button variant="secondary" size="sm"
            id="abc-editor-redo"
            type="button"
            onClick={redo}
            disabled={!canRedo}

          >
            Redo
          </Button>
          <details className={styles.editorTools}><summary>More actions</summary><div>
          <Button variant="danger" size="sm"
            id="abc-editor-reset-sample"
            type="button"
            onClick={resetToSample}

          >
            Reset sample
          </Button>
          <Button variant="danger" size="sm"
            id="abc-editor-clear-draft"
            type="button"
            onClick={clearSavedDraft}

          >
            Clear draft
          </Button>
          </div></details>
        </div>
        {studio && studioActions}
      </div>

      <div className={studio ? styles.editorGrid : "abc-editor-responsive-grid border-b border-zinc-100 dark:border-zinc-800"}>
        <div className={studio ? styles.source : "abc-editor-source-panel min-w-0 space-y-3 p-5 border-r border-zinc-100 dark:border-zinc-800"}>
          <div className="flex items-center justify-between gap-3">
            <span
              id="abc-editor-label"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              ABC source
            </span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Cmd/Ctrl+Z undo · Cmd/Ctrl+Shift+Z redo
            </span>
          </div>

          <AbcSourceEditor
            ref={editorRef}
            id="abc-editor-input"
            ariaLabelledBy="abc-editor-label"
            value={text}
            onChange={commitText}
            onSelectionChange={setSourceSelection}
            onHistoryChange={setHistoryState}
            className={studio ? styles.sourceEditor : "abc-editor-textarea"}
            placeholder={"X:1\nT:My Bhajan\nM:4/4\nK:C\nC D E F | G A B c |"}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{studio && !manageStorage ? "Edit the notation, then listen to check your changes." : storageStatus}</p>

          <Button variant="secondary" size="md"
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            className="mt-2"
          >
            {isValidating ? "Validating..." : "Validate ABCNotation"}
          </Button>
        </div>

        <div className={studio ? styles.preview : "min-w-0 space-y-3 p-5"}>
          {!studio && (
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {studio ? "Your score" : "Music Sheet (ABCJS rendering)"}
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {studio ? "Live preview" : "Bounded preview"}
            </span>
          </div>
          )}

          <GuitarChordAccompaniment
            sourceAbc={text}
            overrides={voicingOverrides ?? localVoicingOverrides}
            onOverridesChange={onVoicingOverridesChange ?? setLocalVoicingOverrides}
            abcString={text}
            title="Editor Music Sheet Preview"
            canvasId="abc-editor-preview"
            useContainerWidth={studio}
            notationScale={studio ? 0.7 : 1}
            hideVoiceNames={studio}
            showExactRenderAbcCopy={studio}
            minWidthClassName="min-w-0"
            sheetViewportClassName="p-4"
            renderOptions={previewRenderOptions}
            sourceSelection={sourceSelection}
            onSourceSelect={(range) => editorRef.current?.selectRange(range)}
          />
        </div>
      </div>

      {validationFeedback && (
        <div className={studio ? styles.validation : "bg-indigo-50/30 dark:bg-indigo-950/30"}>
          <div className="p-5 border-b border-indigo-100 dark:border-indigo-900/50">
            <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-2">AI Suggestion</h4>
            <p className="text-sm text-indigo-800 dark:text-indigo-200 mb-4 whitespace-pre-wrap">
              {validationFeedback}
            </p>
            {validationEdits && validationEdits.length > 0 && (
              <div className="space-y-3 mb-4">
                {validationEdits.map((edit, idx) => (
                  <div key={idx} className="bg-white dark:bg-zinc-900 rounded border border-indigo-100 dark:border-indigo-900 overflow-hidden text-xs font-mono">
                    {edit.explanation && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 border-b border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 font-sans font-medium">
                        {edit.explanation}
                      </div>
                    )}
                    {edit.originalLines && (
                      <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-3 py-2 whitespace-pre-wrap">
                        - {edit.originalLines}
                      </div>
                    )}
                    {edit.newLines && (
                      <div className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-3 py-2 whitespace-pre-wrap">
                        + {edit.newLines}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {validationEdits && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm"
                  type="button"
                  onClick={applySuggestion}

                >
                  Apply Suggestion
                </Button>
                <Button variant="ghost" size="sm"
                  type="button"
                  onClick={dismissSuggestion}

                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>

          {suggestedAbcPreview && (
            <div className="abc-editor-responsive-grid">
              <div className="abc-editor-source-panel min-w-0 space-y-3 p-5 border-r border-indigo-100 dark:border-indigo-900/50">
                <label className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                  Changed ABC source
                </label>
                <textarea
                  value={suggestedAbcPreview}
                  readOnly
                  className="abc-editor-textarea min-h-[420px] w-full resize-y rounded-xl border border-indigo-200 bg-white/50 p-4 font-mono text-sm leading-6 text-indigo-900 shadow-inner focus:outline-none dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100"
                />
              </div>
              <div className="min-w-0 space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                    Changed Music Sheet
                  </h3>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    Suggested preview
                  </span>
                </div>
                <AbcjsPlaybackController
                  abcString={suggestedAbcPreview}
                  title="Changed Editor Music Sheet Preview"
                  canvasId="abc-editor-preview-suggested"
                  minWidthClassName="min-w-0"
                  sheetViewportClassName="p-4"
                  renderOptions={previewRenderOptions}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
