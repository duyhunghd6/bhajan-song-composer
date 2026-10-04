"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { anchoredScroll, clampScoreZoom, fitScoreZoom, wheelZoomDelta } from "./viewport-geometry";
import styles from "./viewport.module.css";
import { Button } from "../../ui/Button";

export interface ScoreViewportProps {
  children: ReactNode;
  toolbar?: ReactNode;
  focusToolbar?: ReactNode;
  height?: number | string;
  className?: string;
  label?: string;
  scoreWidth?: number;
}

function isInput(target: EventTarget | null) {
  return target instanceof Element && !!target.closest("input, textarea, select, button, [contenteditable='true'], [role='textbox']");
}

export function ScoreViewport({ children, toolbar, focusToolbar, height = 560, className = "", label = "Score workspace", scoreWidth = 900 }: ScoreViewportProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [hand, setHand] = useState(false);
  const [space, setSpace] = useState(false);
  const spaceRef = useRef(false);
  const spaceAction = useRef<{ started: number; dragged: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focus, setFocus] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number; pointer: number; moved: boolean; button: number } | null>(null);
  const suppressClick = useRef(false);
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

  const changeZoom = useCallback((value: number, x?: number, y?: number) => {
    const element = viewport.current;
    if (!element) return;
    const next = clampScoreZoom(value);
    pendingScroll.current = {
      left: anchoredScroll(element.scrollLeft, (x ?? element.clientWidth / 2) - 16, zoomRef.current, next),
      top: anchoredScroll(element.scrollTop, (y ?? element.clientHeight / 2) - 16, zoomRef.current, next),
    };
    zoomRef.current = next;
    setZoom(next);
  }, []);

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
      } else if (event.shiftKey && event.deltaY !== 0) {
        event.preventDefault();
        element.scrollLeft += event.deltaY + event.deltaX;
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
    <section ref={root} data-score-workspace-viewport data-score-panning={dragging || undefined} data-score-hand={hand || space || undefined} aria-label={label} className={`${styles.workspace} ${focus ? styles.focus : ""} ${className}`}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          if ((event.target as Element).closest("[role='dialog'], dialog, [aria-modal='true']")) return;
          if (drag.current || spaceRef.current) { event.stopPropagation(); cancelPan(); return; }
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
      <div className={styles.toolbar}>
        <div className={styles.slot}>{toolbar}{focus && focusToolbar}</div>
        <Button size="sm" aria-label="Zoom out" onClick={() => changeZoom(zoomRef.current / 1.2)}>−</Button>
        <output className={styles.zoom} aria-label="Score zoom">{Math.round(zoom * 100)}%</output>
        <Button size="sm" aria-label="Zoom in" onClick={() => changeZoom(zoomRef.current * 1.2)}>+</Button>
        <Button size="sm" onClick={() => changeZoom(fitScoreZoom(viewport.current?.clientWidth ?? 1, size.width))}>Fit width</Button>
        <Button size="sm" onClick={() => changeZoom(1)}>Reset zoom</Button>
        <Button size="sm" aria-pressed={hand} onClick={() => setHand(!hand)}>Hand</Button>
        <Button ref={focusButton} size="sm" aria-pressed={focus} onClick={() => setFocus(!focus)}>{focus ? "Exit focus" : "Focus mode"}</Button>
      </div>
      <div ref={viewport} tabIndex={0} aria-label="Scrollable score" style={{ height }}
        className={`${styles.viewport} ${hand || space ? styles.hand : ""} ${dragging ? styles.dragging : ""}`}
        onScroll={() => setContextMenu(null)}
        onContextMenu={(event) => {
          if ((event.target as Element).closest(".abcjs-note, [data-guitar-chord]")) return;
          event.preventDefault();
          event.stopPropagation();
          setContextMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - 228)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 172)) });
        }}
        onPointerDownCapture={(event) => {
          suppressClick.current = false;
          if (!(event.button === 1 || (event.button === 0 && (hand || spaceRef.current))) || isInput(event.target)) return;
          const element = event.currentTarget;
          const bounds = element.getBoundingClientRect();
          if (event.clientX >= bounds.left + element.clientWidth || event.clientY >= bounds.top + element.clientHeight) return;
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
          if (drag.current || event.button === 1 || (event.button === 0 && (hand || spaceRef.current))) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onPointerMove={(event) => {
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
        onPointerUp={(event) => {
          if (drag.current?.pointer !== event.pointerId) return;
          suppressClick.current = drag.current.moved && drag.current.button === 0;
          drag.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}>
        <div className={styles.surface} style={{ width: size.width * zoom, height: size.height * zoom }}>
          <div ref={content} className={styles.content} style={{ width: scoreWidth, transform: `scale(${zoom})` }}>{children}</div>
        </div>
      </div>
      <div className={styles.hint}>Scroll to navigate · Shift + scroll sideways · Ctrl/⌘ + scroll to zoom · Space + drag or middle mouse to pan</div>
      {contextMenu && createPortal(
        <div ref={menu} role="menu" aria-label="Score viewport actions" className={styles.menu} style={{ left: contextMenu.x, top: contextMenu.y }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
          }}>
          <Button size="sm" role="menuitem" onClick={() => { changeZoom(fitScoreZoom(viewport.current?.clientWidth ?? 1, size.width)); setContextMenu(null); viewport.current?.focus(); }}>Fit width</Button>
          <Button size="sm" role="menuitem" onClick={() => { changeZoom(1); setContextMenu(null); viewport.current?.focus(); }}>Reset zoom</Button>
          <Button size="sm" role="menuitem" onClick={() => { setFocus(!focus); setContextMenu(null); focusButton.current?.focus(); }}>{focus ? "Exit focus" : "Focus mode"}</Button>
        </div>, document.body
      )}
    </section>
  );
}
