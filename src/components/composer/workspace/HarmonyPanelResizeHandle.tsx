import { useEffect, useRef, type PointerEvent } from "react";
import styles from "./harmony.module.css";

const WIDTH_STORAGE_KEY = "bhajan-song-composer:layout:harmony-assistant-width";

export function HarmonyPanelResizeHandle() {
  const handleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WIDTH_STORAGE_KEY);
      const width = saved === null ? NaN : Number(saved);
      if (!Number.isFinite(width) || width < 320 || width > 700) return;
      handleRef.current?.closest<HTMLElement>(`.${styles.workspace}`)
        ?.style.setProperty("--harmony-assistant-width", `${width}px`);
    } catch {
      // Resizing remains available when browser storage is unavailable.
    }
  }, []);
  const resize = (element: HTMLElement, requested: number) => {
    const workspace = element.closest<HTMLElement>(`.${styles.workspace}`);
    const score = workspace?.querySelector<HTMLElement>(`.${styles.score}`);
    const assistant = element.parentElement;
    if (!workspace || !score || !assistant) return;
    const maximum = Math.max(320, Math.min(700, assistant.getBoundingClientRect().width + score.getBoundingClientRect().width - 360));
    const next = Math.round(Math.max(320, Math.min(maximum, requested)));
    workspace.style.setProperty("--harmony-assistant-width", `${next}px`);
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    } catch {
      // Keep the current layout usable even if persistence fails.
    }
  };
  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = handle.parentElement!.getBoundingClientRect().width;
    handle.setPointerCapture(event.pointerId);
    const move = (next: globalThis.PointerEvent) => resize(handle, startWidth + startX - next.clientX);
    const finish = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("lostpointercapture", finish);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("lostpointercapture", finish);
  };
  return (
    <button
      ref={handleRef}
      type="button"
      className={styles.resizeHandle}
      aria-label="Resize harmony assistant"
      title="Drag to resize; use arrow keys to adjust"
      onPointerDown={startDrag}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const current = event.currentTarget.parentElement!.getBoundingClientRect().width;
        resize(event.currentTarget, event.key === "Home" ? 320 : event.key === "End" ? 700 : current + (event.key === "ArrowLeft" ? 20 : -20));
      }}
    ><span aria-hidden="true" /></button>
  );
}
