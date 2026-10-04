import type { NoteTimingEvent } from "./types";

type KeyboardPlayer = { canvas: HTMLElement; toggle: () => void; playing: () => boolean };
const players = new Map<string, KeyboardPlayer>();
let preferred: string | undefined;

function horizontalItems(canvas: HTMLElement, focused: HTMLElement | null): HTMLElement[] {
  if (focused?.hasAttribute("data-guitar-chord")) {
    // Text and diagram are two views of one chord occurrence, not two stops.
    const chords = new Map<string, HTMLElement>();
    canvas.querySelectorAll<HTMLElement>("[data-guitar-chord]").forEach((element) => {
      const id = element.getAttribute("data-guitar-chord")!;
      if (!chords.has(id) || element.tagName === focused.tagName) chords.set(id, element);
    });
    return [...chords.values()];
  }
  const voice = focused?.getAttribute("class")?.match(/\babcjs-v\d+\b/)?.[0];
  // abcjs emits each voice in score-line order; stay in that voice across lines.
  return Array.from(canvas.querySelectorAll<HTMLElement>(".abcjs-note[data-score-item]"))
    .filter((element) => !voice || element.classList.contains(voice));
}

function handleKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const target = event.target instanceof Element ? event.target : null;
  // The workspace waits for keyup to distinguish a Space tap from Space+drag.
  if ((event.code === "Space" || event.key === " ") && target?.closest("[data-score-workspace-viewport]")) return;
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"], dialog[open], [role="dialog"]')) return;
  const focused = [...players.entries()].find(([, player]) => player.canvas.parentElement?.contains(target));
  const active = [...players.entries()].find(([, player]) => player.playing());
  const entry = ((event.code === "Space" || event.key === " ") ? active ?? focused : focused ?? active) ?? (preferred ? [...players.entries()].find(([id]) => id === preferred) : undefined) ?? players.entries().next().value;
  if (!entry) return;
  const [id, player] = entry;
  const items = Array.from(player.canvas.querySelectorAll<HTMLElement>('[data-score-item]'));
  if (event.code === "Space" || event.key === " ") {
    if (target?.closest('button, a, summary, [role="button"]') && !target.closest('[data-score-item]')) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) { preferred = id; player.toggle(); }
  } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    if (target && target !== document.body && !player.canvas.contains(target) && target !== player.canvas) return;
    if (!items.length) return;
    event.preventDefault();
    event.stopPropagation();
    const selected = target?.closest<HTMLElement>("[data-score-item]") ?? null;
    const vertical = ["ArrowUp", "ArrowDown"].includes(event.key);
    const track = vertical ? items : horizontalItems(player.canvas, selected);
    if (!track.length) return;
    const index = track.indexOf(selected!);
    let next = event.key === "Home" ? 0 : event.key === "End" ? track.length - 1
      : Math.max(0, Math.min(track.length - 1, index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1)));
    if (index >= 0 && vertical) {
      const origin = track[index].getBoundingClientRect();
      const x = origin.x + origin.width / 2;
      const y = origin.y + origin.height / 2;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const candidates = track.map((item, i) => {
        const box = item.getBoundingClientRect();
        const dx = Math.abs(box.x + box.width / 2 - x);
        const dy = (box.y + box.height / 2 - y) * direction;
        return { i, dy, distance: dx * 2 + Math.abs(dy) };
      }).filter((item) => item.dy > 4).sort((a, b) => a.distance - b.distance);
      next = candidates[0]?.i ?? index;
    }
    items.forEach((item) => item.setAttribute("tabindex", item === track[next] ? "0" : "-1"));
    preferred = id;
    track[next].focus();
    track[next].scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function handleWorkspacePlayback(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const entry = [...players.entries()].find(([, player]) => target.contains(player.canvas));
  if (!entry) return;
  preferred = entry[0];
  entry[1].toggle();
}

/** One page-level owner prevents multiple score previews from toggling together. */
export function registerKeyboardPlayer(id: string, player: KeyboardPlayer) {
  if (!players.size) {
    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("score-workspace-toggle-playback", handleWorkspacePlayback);
  }
  players.set(id, player);
  return () => {
    players.delete(id);
    if (preferred === id) preferred = undefined;
    if (!players.size) {
      document.removeEventListener("keydown", handleKey, true);
      document.removeEventListener("score-workspace-toggle-playback", handleWorkspacePlayback);
    }
  };
}

export function attachScoreKeyboard(canvas: HTMLElement, timings: NoteTimingEvent[], activate: (event: NoteTimingEvent) => void) {
  const cleanups: (() => void)[] = [];
  const syncFocus = (event: FocusEvent) => {
    const selected = event.target instanceof Element ? event.target.closest("[data-score-item]") : null;
    if (!selected) return;
    canvas.querySelectorAll("[data-score-item]").forEach((item) => item.setAttribute("tabindex", item === selected ? "0" : "-1"));
  };
  canvas.addEventListener("focusin", syncFocus);
  cleanups.push(() => canvas.removeEventListener("focusin", syncFocus));
  canvas.querySelectorAll<HTMLElement>('.abcjs-note, [data-guitar-chord]').forEach((element, index) => {
    element.setAttribute("data-score-item", "true");
    element.setAttribute("tabindex", index === 0 ? "0" : "-1");
    if (element.hasAttribute("data-guitar-chord")) return;
    const timing = timings.find((event) => event.type === "event" && event.elements?.flat().some((node) => node === element || node.contains(element) || element.contains(node)));
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", `Note ${index + 1}${timing ? ` at ${(timing.milliseconds / 1000).toFixed(1)} seconds` : ""}. Enter to select in source`);
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !timing) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) activate(timing);
    };
    element.addEventListener("keydown", keydown);
    cleanups.push(() => element.removeEventListener("keydown", keydown));
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
