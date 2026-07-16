import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { renderCombinedAsciiGuitarTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import { FingerstyleLineCard } from "../FingerstyleLineCard";

vi.mock("@/components/music-sheet/AbcjsPlaybackController", () => ({
  default: ({
    abcString,
    showExactRenderAbcCopy,
    synthOptions,
  }: {
    abcString: string;
    showExactRenderAbcCopy?: boolean;
    synthOptions?: { voicesOff?: boolean | number[]; chordsOff?: boolean };
  }) => (
    <pre
      data-testid="abc-input"
      data-exact-copy={String(showExactRenderAbcCopy)}
      data-synth-options={JSON.stringify(synthOptions)}
    >
      {abcString}
    </pre>
  ),
}));

function makeFinalMeasure(): TimeSliceMeasure {
  const attacks = new Map<number, NonNullable<TimeSliceMeasure["grid"][number]["tablature"]>>([
    [0, [
      { string: 6, fret: 0, finger: "p", role: "bass" },
      { string: 3, fret: 0, finger: "i", role: "fill" },
      { string: 2, fret: 0, finger: "m", role: "melody" },
    ]],
    [2, [{ string: 2, fret: 5, finger: "m", role: "melody" }]],
    [4, [{ string: 3, fret: 0, finger: "i", role: "fill" }]],
    [6, [{ string: 2, fret: 0, finger: "m", role: "melody" }]],
    [14, [{ string: 3, fret: 4, finger: "i", role: "melody" }]],
  ]);

  return {
    measure: 5,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "PIMA",
      voicing_plan: "Open Em",
    },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: { pitch: index === 0 ? "E4" : null, state: index === 0 ? "attack" as const : "rest" as const },
      lyric: null,
      tablature: attacks.get(index),
    })),
    source_abc: {
      melody: "[eBGE,] e G B4 B",
      lyric: "",
      beatWeight: "",
    },
  };
}

describe("FingerstyleLineCard", () => {
  it("passes the exact Resulting ASCII-GuitarTab strings to abcjs", () => {
    const activeAbc = `X:1\nT:Ganesha\nM:4/4\nL:1/8\nK:Em\n| [eBGE,] e G B4 B |`;
    const markup = renderToStaticMarkup(
      <FingerstyleLineCard
        songSlug="ganesha"
        sourceFingerprint="test-source"
        lineIndex={0}
        lineMeasures={[makeFinalMeasure()]}
        activeAbc={activeAbc}
        onUpdateMeasures={() => {}}
        accompLayerVisibility={{ Melody: true, Guitar: true, TAB: true }}
        buildPreviousContext={() => []}
        workflowAppliedMusicAbc={activeAbc}
        generationSettings={{ skillLevel: "beginner", densityMode: "auto" }}
      />
    );

    expect(markup).toContain(
      "[V:Guitar] | [!2!B!3!G-!6!E,-]/2 [!3!G-!6!E,-]/2 [!2!e-!3!G!6!E,-] [!2!e!3!G-!6!E,-] [!2!B-!3!G!6!E,-]4 [!2!B!3!B!6!E,] |"
    );
    expect(markup).toContain('data-exact-copy="true"');
    expect(markup).toContain('data-synth-options="{&quot;voicesOff&quot;:[0],&quot;chordsOff&quot;:true}"');
    expect(markup).toContain("Copy ABCJS ABC");
    expect(markup).toContain("Copy portable ABC");
    expect(markup).toContain(renderCombinedAsciiGuitarTab([makeFinalMeasure()]));
    expect(markup).toContain("overflow-x-auto");
    expect(markup).toContain("whitespace-pre");
    expect(markup).toContain('style="font-size:9.333px;white-space:pre;overflow-wrap:normal;word-break:normal"');
    expect(markup).toContain('Copy ASCII-GuitarTab');
    expect(markup).not.toContain('Copy rendered TAB');
  });
});
