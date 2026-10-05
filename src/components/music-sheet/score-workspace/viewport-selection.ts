export type SelectionItem = { id: string; kind: "note" | "chord"; elements: Element[] };
export type SelectionRect = { left: number; top: number; right: number; bottom: number };

export function selectionRect(x1: number, y1: number, x2: number, y2: number): SelectionRect {
  return { left: Math.min(x1, x2), right: Math.max(x1, x2), top: Math.min(y1, y2), bottom: Math.max(y1, y2) };
}
export function intersectsSelection(a: SelectionRect, b: SelectionRect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
export function scoreSelectionItems(container: HTMLElement): SelectionItem[] {
  const items = new Map<string, SelectionItem>();
  let note = 0;
  container.querySelectorAll(".abcjs-note, [data-guitar-chord]").forEach(element => {
    const chord = element.getAttribute("data-guitar-chord");
    const id = chord !== null ? `chord:${chord}` : `note:${note++}`;
    const item = items.get(id) ?? { id, kind: chord !== null ? "chord" : "note", elements: [] };
    item.elements.push(element);
    items.set(id, item);
  });
  return [...items.values()];
}
export function hitSelection(items: SelectionItem[], rectangle: SelectionRect) {
  return items.filter(item => item.elements.flatMap(element => item.kind === "chord" ? [element] : [...element.querySelectorAll(".abcjs-notehead, .abcjs-stem, path[data-name], .abcjs-rest")].filter(glyph => !glyph.closest("[data-guitar-chord]"))).some(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && intersectsSelection(rectangle, bounds);
  })).map(item => item.id);
}

export function selectionItemAtTarget(items: SelectionItem[], target: Element) {
  const chord = target.closest("[data-guitar-chord]");
  if (chord) return items.find(item => item.kind === "chord" && item.elements.includes(chord));
  const note = target.closest(".abcjs-note");
  return note ? items.find(item => item.kind === "note" && item.elements.includes(note)) : undefined;
}
