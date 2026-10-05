import { describe, expect, it } from "vitest";
import { hitSelection, intersectsSelection, selectionRect, type SelectionItem } from "./viewport-selection";

describe("screen-space score selection", () => {
  it("normalizes a box dragged in any direction", () => {
    expect(selectionRect(80, 100, 20, 10)).toEqual({ left: 20, top: 10, right: 80, bottom: 100 });
  });
  it("selects partially intersecting items and touching edges", () => {
    const box = selectionRect(10, 10, 30, 30);
    expect(intersectsSelection(box, selectionRect(25, 25, 50, 50))).toBe(true);
    expect(intersectsSelection(box, selectionRect(30, 20, 40, 25))).toBe(true);
    expect(intersectsSelection(box, selectionRect(31, 31, 40, 40))).toBe(false);
  });
  it("uses musical glyph bounds rather than a note group containing chord text", () => {
    const glyph = { closest: () => null, getBoundingClientRect: () => ({ left: 20, top: 80, right: 30, bottom: 90, width: 10, height: 10 }) } as unknown as Element;
    const chord = { getBoundingClientRect: () => ({ left: 20, top: 20, right: 40, bottom: 30, width: 20, height: 10 }) } as unknown as Element;
    const note = { querySelectorAll: () => [glyph] } as unknown as Element;
    const items: SelectionItem[] = [{ id: "note:0", kind: "note", elements: [note] }, { id: "chord:C", kind: "chord", elements: [chord, chord] }];
    expect(hitSelection(items, selectionRect(15, 15, 45, 35))).toEqual(["chord:C"]);
    expect(hitSelection(items, selectionRect(15, 75, 35, 95))).toEqual(["note:0"]);
  });
});
