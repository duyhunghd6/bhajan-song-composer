"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Annotation, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import { classHighlighter } from "@lezer/highlight";
import type { SourceRange } from "@/components/music-sheet/abcjs-playback/source-map";
import { abcLanguage } from "./abc-language";
import styles from "./abc-source-editor.module.css";

export interface AbcSourceEditorHandle {
  undo(): void;
  redo(): void;
  /** Selects and scrolls to a range without taking focus from the caller. */
  selectRange(range: SourceRange): void;
}

export interface AbcSourceEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (range: SourceRange) => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  ariaLabelledBy?: string;
  placeholder?: string;
  className?: string;
  ref?: Ref<AbcSourceEditorHandle>;
}

// Marks transactions that mirror the `value` prop so they are not echoed back.
const externalValue = Annotation.define<boolean>();

/** Minimal replacement that keeps the caret and undo steps local to the edit. */
function diffReplacement(current: string, next: string) {
  let from = 0;
  while (from < current.length && from < next.length && current[from] === next[from]) from += 1;
  let currentTo = current.length;
  let nextTo = next.length;
  while (currentTo > from && nextTo > from && current[currentTo - 1] === next[nextTo - 1]) {
    currentTo -= 1;
    nextTo -= 1;
  }
  return { from, to: currentTo, insert: next.slice(from, nextTo) };
}

export default function AbcSourceEditor({
  id,
  value,
  onChange,
  onSelectionChange,
  onHistoryChange,
  ariaLabelledBy,
  placeholder,
  className,
  ref,
}: AbcSourceEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacksRef = useRef({ onChange, onSelectionChange, onHistoryChange });
  const initialRef = useRef({ value, id, ariaLabelledBy, placeholder });

  useEffect(() => {
    callbacksRef.current = { onChange, onSelectionChange, onHistoryChange };
  }, [onChange, onSelectionChange, onHistoryChange]);

  useEffect(() => {
    if (!hostRef.current) return;
    const initial = initialRef.current;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initial.value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          abcLanguage,
          syntaxHighlighting(classHighlighter),
          keymap.of([...historyKeymap, ...defaultKeymap]),
          ...(initial.placeholder ? [placeholderExtension(initial.placeholder)] : []),
          EditorView.contentAttributes.of({
            id: initial.id,
            "aria-multiline": "true",
            ...(initial.ariaLabelledBy ? { "aria-labelledby": initial.ariaLabelledBy } : {}),
            spellcheck: "false",
            autocorrect: "off",
            autocapitalize: "off",
          }),
          EditorView.updateListener.of((update) => {
            const callbacks = callbacksRef.current;
            const isExternal = update.transactions.some((transaction) => transaction.annotation(externalValue));
            if (update.docChanged && !isExternal) callbacks.onChange(update.state.doc.toString());
            if (update.docChanged || update.selectionSet) {
              const { from, to } = update.state.selection.main;
              callbacks.onSelectionChange?.({ start: from, end: to });
            }
            if (update.transactions.length) {
              callbacks.onHistoryChange?.({
                canUndo: undoDepth(update.state) > 0,
                canRedo: redoDepth(update.state) > 0,
              });
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: diffReplacement(current, value), annotations: externalValue.of(true) });
  }, [value]);

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (viewRef.current) undo(viewRef.current);
    },
    redo: () => {
      if (viewRef.current) redo(viewRef.current);
    },
    selectRange: ({ start, end }) => {
      const view = viewRef.current;
      if (!view) return;
      const length = view.state.doc.length;
      const anchor = Math.max(0, Math.min(length, start));
      const head = Math.max(anchor, Math.min(length, end));
      view.dispatch({
        selection: { anchor, head },
        effects: EditorView.scrollIntoView(anchor, { y: "nearest", yMargin: 48 }),
      });
    },
  }), []);

  return <div ref={hostRef} className={[styles.frame, className].filter(Boolean).join(" ")} />;
}
