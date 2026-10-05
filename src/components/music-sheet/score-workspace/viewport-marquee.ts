import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { hitSelection, scoreSelectionItems, selectionItemAtTarget, selectionRect, type SelectionItem } from "./viewport-selection";

type Gesture = { pointer: number; x: number; y: number; clientX: number; clientY: number; initialX: number; initialY: number; moved: boolean; add: boolean; baseline: Set<string>; clicked?: string; items: SelectionItem[] };

export function useScoreMarquee(viewport: RefObject<HTMLDivElement | null>) {
  const gesture = useRef<Gesture | null>(null);
  const selected = useRef(new Set<string>());
  const selectedNodes = useRef<Element[]>([]);
  const [counts, setCounts] = useState({ notes: 0, chords: 0 });
  const [owned, setOwned] = useState(false);
  const [active, setActive] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const frame = useRef<number | null>(null);
  const apply = useCallback((ids: Set<string>, items?: SelectionItem[], target?: Element) => {
    const container = viewport.current;
    if (!container) return;
    const all = items ?? scoreSelectionItems(container);
    selected.current = ids;
    selectedNodes.current = all.filter(item => ids.has(item.id)).flatMap(item => item.elements);
    for (const item of all) for (const element of item.elements) {
      if (ids.has(item.id)) element.setAttribute("data-score-marquee-selected", "true");
      else element.removeAttribute("data-score-marquee-selected");
    }
    const chosen = all.filter(item => ids.has(item.id)).map(({ id, kind }) => ({ id, kind }));
    const notes = chosen.filter(item => item.kind === "note").length;
    const chords = chosen.length - notes;
    setCounts({ notes, chords });
    container.dispatchEvent(new CustomEvent("score-workspace-selection-change", { bubbles: true, detail: { items: chosen, noteCount: notes, chordCount: chords, target, transient: Boolean(gesture.current?.moved) } }));
  }, [viewport]);
  const update = useCallback(() => {
    const start = gesture.current;
    const element = viewport.current;
    if (!start?.moved || !element) return;
    const bounds = element.getBoundingClientRect();
    const screen = selectionRect(bounds.left + start.x - element.scrollLeft, bounds.top + start.y - element.scrollTop, start.clientX, start.clientY);
    const hits = hitSelection(start.items, screen);
    apply(new Set([...(start.add ? start.baseline : []), ...hits]), start.items);
    setBox({ left: screen.left - bounds.left + element.scrollLeft, top: screen.top - bounds.top + element.scrollTop, width: screen.right - screen.left, height: screen.bottom - screen.top });
  }, [apply, viewport]);
  const stop = useCallback((restore: boolean) => {
    const start = gesture.current;
    gesture.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (restore && start) apply(start.baseline, start.items);
    if (start && viewport.current?.hasPointerCapture(start.pointer)) viewport.current.releasePointerCapture(start.pointer);
    setActive(false);
    setBox(null);
  }, [apply, viewport]);
  useEffect(() => {
    const blur = () => stop(true);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("blur", blur); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [stop]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new MutationObserver(() => {
      if (selectedNodes.current.some(node => !element.contains(node))) {
        stop(false);
        apply(new Set());
      }
    });
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [apply, stop, viewport]);
  const scroll = useCallback(function tick() {
    const start = gesture.current;
    const element = viewport.current;
    if (!start?.moved || !element) return;
    const bounds = element.getBoundingClientRect();
    const speed = (point: number, low: number, high: number) => point < low + 32 ? -Math.min(14, (low + 32 - point) / 3) : point > high - 32 ? Math.min(14, (point - high + 32) / 3) : 0;
    element.scrollLeft += speed(start.clientX, bounds.left, bounds.left + element.clientWidth);
    element.scrollTop += speed(start.clientY, bounds.top, bounds.top + element.clientHeight);
    update();
    frame.current = requestAnimationFrame(tick);
  }, [update, viewport]);
  return {
    counts, owned, active, box,
    context: (target: Element) => {
      const element = viewport.current;
      if (!element) return;
      const items = scoreSelectionItems(element);
      const item = selectionItemAtTarget(items, target);
      if (!item || selected.current.has(item.id)) return;
      setOwned(true);
      apply(new Set([item.id]), items, target);
    },
    cancel: () => { if (!gesture.current) return false; stop(true); return true; },
    clear: () => { if (!selected.current.size) return false; apply(new Set()); setOwned(true); return true; },
    down: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.altKey || event.pointerType === "touch") return false;
      const element = event.currentTarget;
      const bounds = element.getBoundingClientRect();
      const items = scoreSelectionItems(element);
      const target = event.target as Element;
      const clicked = selectionItemAtTarget(items, target)?.id;
      gesture.current = { pointer: event.pointerId, x: event.clientX - bounds.left + element.scrollLeft, y: event.clientY - bounds.top + element.scrollTop, clientX: event.clientX, clientY: event.clientY, initialX: event.clientX, initialY: event.clientY, moved: false, add: event.shiftKey, baseline: new Set(selected.current), clicked, items };
      setOwned(true);
      element.focus({ preventScroll: true });
      event.preventDefault(); event.stopPropagation();
      return true;
    },
    move: (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = gesture.current;
      if (!start || start.pointer !== event.pointerId) return false;
      start.clientX = event.clientX; start.clientY = event.clientY;
      if (!start.moved && Math.hypot(event.clientX - start.initialX, event.clientY - start.initialY) > 4) {
        start.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(true);
        frame.current = requestAnimationFrame(scroll);
      }
      update();
      event.preventDefault(); event.stopPropagation();
      return true;
    },
    up: (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = gesture.current;
      if (!start || start.pointer !== event.pointerId) return false;
      if (!start.moved) {
        const ids = new Set(start.add ? start.baseline : []);
        if (start.clicked) { if (start.add && ids.has(start.clicked)) ids.delete(start.clicked); else ids.add(start.clicked); }
        const target = start.items.find(item => item.id === start.clicked)?.elements[0];
        apply(ids, start.items, target);
        (target as HTMLElement | undefined)?.focus?.({ preventScroll: true });
      }
      stop(false);
      if (start.moved) apply(new Set(selected.current), start.items);
      event.preventDefault(); event.stopPropagation();
      return start.moved ? "drag" : "click";
    },
    pending: () => !!gesture.current,
  };
}
