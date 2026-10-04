import { primaryVoiceElements, type GuitarChordScore, type GuitarChordShape, type GuitarParsedTune } from "@/lib/theory/guitar-chord-score";
import { isAbcChordSymbol } from "@/lib/theory/abc-chord-symbol";

const NS = "http://www.w3.org/2000/svg";
const SCORE_DIAGRAM_WIDTH = 32.2;
const SCORE_DIAGRAM_HEIGHT = 34.3;
const SCORE_DIAGRAM_SPACING = SCORE_DIAGRAM_HEIGHT + 5;

/** Geometry is shared by the score and picker; only trusted numeric shape data is emitted. */
export function guitarDiagramMarkup(shape: GuitarChordShape): string {
  const fretted = shape.frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
  const start = Math.max(...fretted, 0) <= 4 ? 1 : Math.min(...fretted);
  const x = (index: number) => 16 + index * 10;
  const y = (fret: number) => 24 + (fret - start + 0.5) * 11;
  const parts: string[] = [];
  for (let string = 0; string < 6; string++) parts.push(`<path d="M${x(string)} 24V79" stroke="#52525b" stroke-width="0.8"/>`);
  for (let fret = 0; fret <= 5; fret++) parts.push(`<path d="M16 ${24 + fret * 11}H66" stroke="#52525b" stroke-width="${fret === 0 && start === 1 ? 2.5 : 0.8}"/>`);
  if (start > 1) parts.push(`<text x="3" y="33" font-size="9" fill="#52525b">${start}</text>`);
  if (shape.barre) {
    const barre = shape.barre;
    parts.push(`<path d="M${x(6 - barre.fromString)} ${y(barre.fret)}H${x(6 - barre.toString)}" stroke="#4338ca" stroke-width="7" stroke-linecap="round"/>`);
  }
  shape.frets.forEach((fret, index) => {
    if (fret === "X" || fret === 0) {
      parts.push(`<text x="${x(index)}" y="18" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#27272a">${fret === "X" ? "×" : "○"}</text>`);
    } else {
      parts.push(`<circle cx="${x(index)}" cy="${y(fret)}" r="4" fill="#4338ca"/>`);
      const finger = shape.fingers?.[index];
      if (typeof finger === "number") parts.push(`<text x="${x(index)}" y="${y(fret) + 2.5}" text-anchor="middle" font-size="7" font-family="sans-serif" fill="white">${finger}</text>`);
    }
  });
  return parts.join("");
}

export function attachGuitarChordDiagrams(container: HTMLDivElement, tune: GuitarParsedTune, score: GuitarChordScore, onSelect: (id: string) => void, onContextMenu?: (id: string, x: number, y: number) => void): () => void {
  const cleanups: (() => void)[] = [];
  const rows = new Map<Element, { bottom: number; lanes: number; rights: number[] }>();
  let index = 0;
  for (const element of primaryVoiceElements(tune)) {
    const symbol = element.chord?.find((chord) => chord.position === "default" && isAbcChordSymbol(chord.name));
    if (!symbol) continue;
    const occurrence = score.occurrences[index++];
    if (!occurrence) continue;
    const elements = element.abselem?.elemset ?? [];
    const chordText = elements.flatMap((node) => [node, ...Array.from(node.querySelectorAll?.(".abcjs-chord") ?? [])])
      .find((node) => node.classList?.contains("abcjs-chord")) as SVGGraphicsElement | undefined;
    if (!chordText) continue;
    const wrapper = chordText.closest(".abcjs-staff-wrapper");
    const svg = chordText.ownerSVGElement;
    if (!wrapper || !svg) continue;
    const box = chordText.getBBox();
    const row = rows.get(wrapper) ?? { bottom: 0, lanes: 0, rights: [] };
    const left = Math.max(0, box.x + box.width / 2 - SCORE_DIAGRAM_WIDTH / 2);
    let lane = row.rights.findIndex((right) => right + 5 <= left);
    if (lane < 0) lane = row.rights.length;
    row.rights[lane] = left + SCORE_DIAGRAM_WIDTH;
    row.lanes = Math.max(row.lanes, lane + 1);
    rows.set(wrapper, row);
    const diagram = document.createElementNS(NS, "svg");
    diagram.setAttribute("x", String(left));
    diagram.setAttribute("y", String(box.y - SCORE_DIAGRAM_SPACING * (lane + 1)));
    diagram.setAttribute("width", String(SCORE_DIAGRAM_WIDTH));
    diagram.setAttribute("height", String(SCORE_DIAGRAM_HEIGHT));
    diagram.setAttribute("viewBox", "0 0 84 88");
    if (occurrence.selected) diagram.innerHTML = guitarDiagramMarkup(occurrence.selected);
    wrapper.appendChild(diagram);
    for (const target of [chordText, diagram]) {
      target.setAttribute("data-guitar-chord", occurrence.id);
      target.setAttribute("role", "button");
      target.setAttribute("tabindex", "0");
      target.setAttribute("aria-label", `Choose guitar shape for ${occurrence.symbol}, measure ${occurrence.measureIndex + 1}, beat ${occurrence.beat}`);
      target.style.cursor = "pointer";
      const click = (event: Event) => { event.preventDefault(); event.stopPropagation(); target.focus({ preventScroll: true }); onSelect(occurrence.id); };
      const keydown = (event: Event) => {
        if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") click(event);
      };
      // abcjs seeks on mouseup/touchend, before the browser dispatches click.
      const stopSelection = (event: Event) => event.stopPropagation();
      for (const name of ["mousedown", "mouseup", "touchstart", "touchend"]) {
        target.addEventListener(name, stopSelection, { capture: true, passive: true });
        cleanups.push(() => target.removeEventListener(name, stopSelection, true));
      }
      const contextmenu = (event: Event) => {
        if (!onContextMenu) { click(event); return; }
        event.preventDefault(); event.stopPropagation();
        const pointer = event as MouseEvent; onContextMenu(occurrence.id, pointer.clientX, pointer.clientY);
      };
      target.addEventListener("contextmenu", contextmenu, true);
      target.addEventListener("click", click, true);
      target.addEventListener("keydown", keydown, true);
      cleanups.push(() => { target.removeEventListener("contextmenu", contextmenu, true); target.removeEventListener("click", click, true); target.removeEventListener("keydown", keydown, true); });
    }
  }
  // Add real space to every staff system, including the PDF's SVG snapshot.
  for (const svg of Array.from(container.querySelectorAll("svg.abcjs-svg, svg[role='img']"))) {
    let extra = 0;
    for (const wrapper of Array.from(svg.querySelectorAll(".abcjs-staff-wrapper"))) {
      extra += (rows.get(wrapper)?.lanes ?? 0) * SCORE_DIAGRAM_SPACING;
      wrapper.setAttribute("transform", `translate(0 ${extra}) ${wrapper.getAttribute("transform") ?? ""}`);
    }
    const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    if (extra && viewBox?.length === 4) {
      const height = viewBox[3] + extra;
      svg.setAttribute("viewBox", `${viewBox[0]} ${viewBox[1]} ${viewBox[2]} ${height}`);
      if (svg.hasAttribute("height") && svg.getAttribute("height") !== "100%") svg.setAttribute("height", String(height));
      const parent = svg.parentElement;
      if (parent?.style.paddingBottom) parent.style.paddingBottom = `${height / viewBox[2] * 100}%`;
    }
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}
