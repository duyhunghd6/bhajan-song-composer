"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { buildAbcSourceMap, trimSourceRange, type SourceRange } from "./source-map";
import {
  applySourceHighlight,
  buildScoreSourceIndex,
  resolveScoreTargets,
  revealInViewport,
  type ScoreSourceElement,
} from "./source-selection";
import type { VisualObj } from "./types";

interface ScoreSourceSelectionOptions {
  /** The caller's ABC, i.e. the coordinate space of `sourceSelection`. */
  abcString: string;
  /** The exact string rendered by abcjs. */
  renderedAbc: string;
  /** Controlled selection; `undefined` lets score clicks keep a local one. */
  sourceSelection?: SourceRange | null;
  onSourceSelect?: (range: SourceRange) => void;
  viewportRef: RefObject<HTMLElement | null>;
}

/**
 * Two-way link between a source selection and the engraved score:
 * selection → highlighted elements, and score element → source range.
 * The returned callbacks are stable so the render effect can depend on them.
 */
export function useScoreSourceSelection({
  abcString,
  renderedAbc,
  sourceSelection,
  onSourceSelect,
  viewportRef,
}: ScoreSourceSelectionOptions) {
  const sourceMap = useMemo(() => buildAbcSourceMap(abcString, renderedAbc), [abcString, renderedAbc]);
  const [localSelection, setLocalSelection] = useState<SourceRange | null>(null);
  const selection = sourceSelection !== undefined ? sourceSelection : localSelection;
  const indexRef = useRef<ScoreSourceElement[]>([]);
  const highlightedRef = useRef<Element[]>([]);
  const latestRef = useRef({ abcString, sourceMap, selection, onSourceSelect });

  // Declared before the caller's render effect, so it runs first in each commit.
  useEffect(() => {
    latestRef.current = { abcString, sourceMap, selection, onSourceSelect };
  });

  const highlight = useCallback(() => {
    const { abcString: text, selection: current } = latestRef.current;
    const targets = current ? resolveScoreTargets(indexRef.current, text, current) : [];
    highlightedRef.current = applySourceHighlight(highlightedRef.current, targets);
    const first = highlightedRef.current[0];
    if (first && viewportRef.current) revealInViewport(viewportRef.current, first);
  }, [viewportRef]);

  useEffect(() => {
    highlight();
  }, [selection, highlight]);

  /** Call after every abcjs render; the previous elements are gone. */
  const indexRenderedScore = useCallback((visualObj: VisualObj | null) => {
    indexRef.current = visualObj ? buildScoreSourceIndex(visualObj, latestRef.current.sourceMap) : [];
    highlightedRef.current = [];
    highlight();
  }, [highlight]);

  /** Selects the source range of an engraved element (abcjs `startChar`/`endChar`). */
  const selectRenderedRange = useCallback((startChar: number, endChar: number) => {
    const { abcString: text, sourceMap: map, onSourceSelect: report } = latestRef.current;
    const range = trimSourceRange(text, { start: map.toSource(startChar), end: map.toSource(endChar) });
    setLocalSelection(range);
    report?.(range);
  }, []);

  return { indexRenderedScore, selectRenderedRange };
}
