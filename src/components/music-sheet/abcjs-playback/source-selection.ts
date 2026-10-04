import { resolveLyricNoteTargets } from "./lyric-alignment";
import type { AbcSourceMap, SourceRange } from "./source-map";
import type { VisualObj } from "./types";

/**
 * Links a source selection to engraved score elements. Highlighting is a
 * preview-only class toggle; it never touches the ABC, drafts, or exports.
 */
export const SOURCE_SELECTED_CLASS = "abcjs-source-selected";

export type ScoreSourceKind = "note" | "rest" | "bar" | "other";

export interface ScoreSourceElement extends SourceRange {
  kind: ScoreSourceKind;
  elements: Element[];
}

// abcjs engraver internals (`tune.engraver`, set by renderAbc). The same tree
// backs abcjs's own `rangeHighlight`, which this index mirrors.
type EngravedElement = {
  abcelem?: { el_type?: string; startChar?: number; endChar?: number; rest?: unknown };
  elemset?: (Element | null | undefined)[];
};
type Engraver = { staffgroups?: { voices?: { children?: EngravedElement[] }[] }[] };

function kindOf(abcelem: NonNullable<EngravedElement["abcelem"]>): ScoreSourceKind {
  if (abcelem.el_type === "note") return abcelem.rest ? "rest" : "note";
  return abcelem.el_type === "bar" ? "bar" : "other";
}

/** Indexes engraved elements by their range in the caller's source ABC. */
export function buildScoreSourceIndex(visualObj: VisualObj, map: AbcSourceMap): ScoreSourceElement[] {
  const engraver = (visualObj as { engraver?: Engraver }).engraver;
  const index: ScoreSourceElement[] = [];
  for (const staffGroup of engraver?.staffgroups ?? []) {
    for (const voice of staffGroup.voices ?? []) {
      for (const child of voice.children ?? []) {
        const abcelem = child.abcelem;
        if (!abcelem || abcelem.startChar === undefined || abcelem.endChar === undefined) continue;
        if (abcelem.startChar < 0 || abcelem.endChar <= abcelem.startChar) continue;
        const elements = (child.elemset ?? []).filter((element): element is Element => Boolean(element));
        if (!elements.length) continue;
        index.push({
          start: map.toSource(abcelem.startChar),
          end: map.toSource(abcelem.endChar),
          kind: kindOf(abcelem),
          elements,
        });
      }
    }
  }
  return index.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Score elements addressed by a source selection (caret or range). */
export function resolveScoreTargets(
  index: readonly ScoreSourceElement[],
  text: string,
  range: SourceRange,
): ScoreSourceElement[] {
  const lyricTargets = resolveLyricNoteTargets(
    text,
    range,
    index.filter((element) => element.kind === "note"),
    index.filter((element) => element.kind === "bar"),
  );
  if (lyricTargets) return lyricTargets;

  if (range.end > range.start) {
    return index.filter((element) => range.end > element.start && range.start < element.end);
  }
  // abcjs ranges are contiguous within a music line (they absorb surrounding
  // whitespace), so a caret is almost always inside one; at a line end it sits
  // just after the last element.
  const caret = range.start;
  const containing = index.filter((element) => element.start <= caret && caret < element.end);
  return containing.length ? containing : index.filter((element) => element.end === caret);
}

export function applySourceHighlight(previous: readonly Element[], targets: readonly ScoreSourceElement[]): Element[] {
  previous.forEach((element) => element.classList.remove(SOURCE_SELECTED_CLASS));
  const next = targets.flatMap((target) => target.elements);
  next.forEach((element) => element.classList.add(SOURCE_SELECTED_CLASS));
  return next;
}

/** Scrolls only the score viewport, so the editor beside it never jumps. */
export function revealInViewport(viewport: HTMLElement, element: Element, margin = 24) {
  const bounds = viewport.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  if (target.top < bounds.top + margin) viewport.scrollTop -= bounds.top + margin - target.top;
  else if (target.bottom > bounds.bottom - margin) viewport.scrollTop += target.bottom - (bounds.bottom - margin);
  if (target.left < bounds.left + margin) viewport.scrollLeft -= bounds.left + margin - target.left;
  else if (target.right > bounds.right - margin) viewport.scrollLeft += target.right - (bounds.right - margin);
}
