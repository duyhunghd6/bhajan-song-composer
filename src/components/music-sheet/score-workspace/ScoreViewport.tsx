"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PlaybackSpeedMenu } from "../abcjs-playback/playback-speed";
import { createPortal } from "react-dom";
import { anchoredScroll, clampScoreZoom, fitScoreZoom, wheelZoomDelta } from "./viewport-geometry";
import styles from "./viewport.module.css";
import { useScoreMarquee } from "./viewport-marquee";
import { Button } from "../../ui/Button";

export interface ScoreViewportProps {
  children: ReactNode;
  toolbar?: ReactNode;
  focusToolbar?: ReactNode;
  height?: number | string;
  className?: string;
  label?: string;
  scoreWidth?: number;
  controllerSlot?: HTMLElement | null;
  embedded?: boolean;
}

function isInput(target: EventTarget | null) {
  return target instanceof Element && !!target.closest("input, textarea, select, button, [contenteditable='true'], [role='textbox']");
}

export function ScoreViewport({ children, height = 560, className = "", label = "Score workspace", scoreWidth, controllerSlot, embedded = false }: ScoreViewportProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const marquee = useScoreMarquee(viewport);
  const content = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [availableWidth, setAvailableWidth] = useState(0);
  const [hand, setHand] = useState(false);
  const [space, setSpace] = useState(false);
  const spaceRef = useRef(false);
  const spaceAction = useRef<{ started: number; dragged: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focus, setFocus] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number; pointer: number; moved: boolean; button: number } | null>(null);
  const suppressClick = useRef(false);
  const allowDoubleClick = useRef(false);
  const cancelPan = useCallback(() => {
    const active = drag.current;
    if (active && viewport.current?.hasPointerCapture(active.pointer)) viewport.current.releasePointerCapture(active.pointer);
    drag.current = null;
    spaceAction.current = null;
    spaceRef.current = false;
    setSpace(false);
    setDragging(false);
  }, []);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const inset = embedded && !focus ? 0 : 16;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setAvailableWidth(Math.max(1, element.clientWidth - inset * 2));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [inset]);

  const changeZoom = useCallback((value: number, x?: number, y?: number) => {
    const element = viewport.current;
    if (!element) return;
    const next = clampScoreZoom(value);
    pendingScroll.current = {
      left: anchoredScroll(element.scrollLeft, (x ?? element.clientWidth / 2) - inset, zoomRef.current, next),
      top: anchoredScroll(element.scrollTop, (y ?? element.clientHeight / 2) - inset, zoomRef.current, next),
    };
    zoomRef.current = next;
    setZoom(next);
  }, [inset]);

  useLayoutEffect(() => {
    if (pendingScroll.current && viewport.current) {
      viewport.current.scrollLeft = pendingScroll.current.left;
      viewport.current.scrollTop = pendingScroll.current.top;
      pendingScroll.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => setSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = element.getBoundingClientRect();
        const delta = wheelZoomDelta(event.deltaY, event.deltaMode, element.clientHeight);
        changeZoom(zoomRef.current * Math.exp(-Math.max(-1000, Math.min(1000, delta)) * 0.002), event.clientX - rect.left, event.clientY - rect.top);
      } else if (event.shiftKey) {
        event.preventDefault();
        // Some browsers already translate Shift+wheel into deltaX.
        element.scrollLeft += wheelZoomDelta(event.deltaX || event.deltaY, event.deltaMode, element.clientWidth);
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [changeZoom]);

  useEffect(() => {
    const release = () => {
      cancelPan();
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        const action = spaceAction.current;
        if (action && !action.dragged && performance.now() - action.started < 500) {
          viewport.current?.dispatchEvent(new CustomEvent("score-workspace-toggle-playback", { bubbles: true }));
        }
        spaceAction.current = null;
        spaceRef.current = false;
        setSpace(false);
      }
    };
    window.addEventListener("blur", release);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("keyup", keyup);
    };
  }, [cancelPan]);

  useEffect(() => {
    if (!focus) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;

    };
  }, [focus]);

  useEffect(() => {
    if (!contextMenu) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenu(null);
      viewport.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [contextMenu]);

  return (
    <section ref={root} data-score-workspace-viewport data-score-panning={dragging || undefined} data-score-marquee-active={marquee.active || undefined} data-score-selection-owned={marquee.owned || undefined} data-score-hand={hand || space || undefined} aria-label={label} className={`${styles.workspace} ${embedded && !focus ? styles.embedded : ""} ${focus ? styles.focus : ""} ${className}`}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          if ((event.target as Element).closest("[role='dialog'], dialog, [aria-modal='true']")) return;
          if (event.currentTarget.querySelector('[data-score-note-dragging="true"]')) return;
          if (marquee.cancel()) { event.preventDefault(); event.stopPropagation(); suppressClick.current = true; return; }
          if (drag.current || spaceRef.current) { event.stopPropagation(); cancelPan(); return; }
          if (marquee.clear()) { event.preventDefault(); event.stopPropagation(); return; }
          if (focus) { event.stopPropagation(); setFocus(false); focusButton.current?.focus(); }
          return;
        }
        if (isInput(event.target) || event.code !== "Space") return;
        event.preventDefault();
        event.stopPropagation();
        if (!spaceRef.current) spaceAction.current = { started: performance.now(), dragged: false };
        spaceRef.current = true;
        setSpace(true);
      }}>
      {controllerSlot && createPortal(<div className={styles.toolbar}>
        <Button size="sm" aria-label="Score zoom" title="Score view actions" aria-haspopup="menu" onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setContextMenu({ x: Math.max(8, Math.min(rect.left, window.innerWidth - 228)), y: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 280)) });
        }}>{Math.round(zoom * 100)}%</Button>
      </div>, controllerSlot)}
      <div ref={viewport} data-score-scroll-viewport tabIndex={0} aria-label="Scrollable score" style={{ height }}
        className={`${styles.viewport} ${hand || space ? styles.hand : ""} ${dragging ? styles.dragging : ""}`}
        onScroll={() => setContextMenu(null)}
        onContextMenuCapture={(event) => marquee.context(event.target as Element)}
        onContextMenu={(event) => {
          if ((event.target as Element).closest(".abcjs-note, [data-guitar-chord]")) return;
          event.preventDefault();
          event.stopPropagation();
          setContextMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - 228)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 280)) });
        }}
        onPointerDownCapture={(event) => {
          suppressClick.current = false;
          allowDoubleClick.current = false;
          if (isInput(event.target)) return;
          const element = event.currentTarget;
          const bounds = element.getBoundingClientRect();
          if (event.clientX >= bounds.left + element.clientWidth || event.clientY >= bounds.top + element.clientHeight) return;
          const pan = event.button === 1 || (event.button === 0 && (hand || spaceRef.current || event.metaKey || event.ctrlKey));
          // A plain diagram click opens its picker; modified gestures keep workspace selection/pan.
          if (!pan && !event.shiftKey && !event.altKey && (event.target as Element).closest('[data-guitar-chord-diagram]')) return;
          if (!pan) { marquee.down(event); return; }
          event.preventDefault();
          event.stopPropagation();
          element.focus({ preventScroll: true });
          element.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop, pointer: event.pointerId, moved: false, button: event.button };
          setDragging(true);
        }}
        onMouseDownCapture={(event) => {
          if (isInput(event.target)) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX >= bounds.left + event.currentTarget.clientWidth || event.clientY >= bounds.top + event.currentTarget.clientHeight) return;
          if (drag.current || marquee.pending() || event.button === 1 || (event.button === 0 && (hand || spaceRef.current || event.metaKey || event.ctrlKey))) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onPointerMoveCapture={(event) => {
          if (marquee.move(event)) return;
          const start = drag.current;
          if (!start || start.pointer !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) {
            start.moved = true;
            if (spaceAction.current) spaceAction.current.dragged = true;
          }
          event.currentTarget.scrollLeft = start.left - dx;
          event.currentTarget.scrollTop = start.top - dy;
        }}
        onMouseUpCapture={(event) => {
          if (suppressClick.current || marquee.pending()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onPointerUpCapture={(event) => {
          const selectionGesture = marquee.up(event);
          if (selectionGesture) { suppressClick.current = true; allowDoubleClick.current = selectionGesture === "click"; return; }
          if (drag.current?.pointer !== event.pointerId) return;
          suppressClick.current = drag.current.button === 0;
          drag.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => { marquee.cancel(); drag.current = null; setDragging(false); }}
        onPointerCancel={() => { marquee.cancel(); drag.current = null; setDragging(false); }}
        onClickCapture={(event) => {
          if (event.detail >= 2 && allowDoubleClick.current && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) { suppressClick.current = false; return; }
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}>
        {marquee.box && <div aria-hidden="true" className={styles.marquee} style={marquee.box} />}
        <div className={styles.surface} style={{ width: size.width * zoom, height: size.height * zoom }}>
          <div ref={content} className={styles.content} style={{ width: scoreWidth ?? (availableWidth || "100%"), transform: `scale(${zoom})` }}>{children}</div>
        </div>
      </div>
      {contextMenu && createPortal(
        <div ref={menu} role="menu" aria-label="Score viewport actions" className={styles.menu} style={{ left: contextMenu.x, top: contextMenu.y }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
          }}>
          <PlaybackSpeedMenu close={() => { setContextMenu(null); viewport.current?.focus(); }} />
          <Button size="sm" role="menuitem" onClick={() => { changeZoom(scoreWidth ? fitScoreZoom(availableWidth + 32, size.width) : 1); setContextMenu(null); viewport.current?.focus(); }}>Fit width</Button>
          <Button size="sm" role="menuitem" onClick={() => { changeZoom(1); setContextMenu(null); viewport.current?.focus(); }}>Reset view</Button>
          <Button size="sm" role="menuitem" aria-pressed={hand} onClick={() => { setHand(!hand); setContextMenu(null); viewport.current?.focus(); }}>{hand ? "Exit hand mode" : "Hand mode"}</Button>
          <Button size="sm" role="menuitem" onClick={() => { setFocus(!focus); setContextMenu(null); focusButton.current?.focus(); }}>{focus ? "Exit focus" : "Focus mode"}</Button>
        </div>, document.body
      )}
    </section>
  );
}
