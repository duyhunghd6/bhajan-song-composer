import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AccompanimentStep } from "../AccompanimentStep";
import { HarmonyStep } from "../HarmonyStep";

vi.mock("@/components/music-sheet/AbcjsPlaybackController", () => ({
  default: ({
    abcString,
    useContainerWidth,
    hideVoiceNames,
    showExactRenderAbcCopy,
    minWidthClassName,
    sheetViewportClassName,
    renderOptions,
    synthOptions,
  }: {
    abcString: string;
    useContainerWidth?: boolean;
    hideVoiceNames?: boolean;
    showExactRenderAbcCopy?: boolean;
    minWidthClassName?: string;
    sheetViewportClassName?: string;
    renderOptions?: Record<string, unknown>;
    synthOptions?: Record<string, unknown>;
  }) => (
    <output
      data-abc={abcString}
      data-use-container-width={String(useContainerWidth)}
      data-hide-voice-names={String(hideVoiceNames)}
      data-copy-abcjs={String(showExactRenderAbcCopy)}
      data-min-width={minWidthClassName}
      data-viewport={sheetViewportClassName}
      data-render-options={JSON.stringify(renderOptions)}
      data-synth-options={JSON.stringify(synthOptions)}
    />
  ),
}));

vi.mock("../../AccompanimentWorkflowWizard", () => ({
  default: () => <div data-testid="workflow" />,
}));

vi.mock("../LayerVisibilityControls", () => ({
  LayerVisibilityControls: () => <div data-testid="layer-visibility" />,
}));

const noop = () => undefined;
const staffAbc = "X:1\nT:Ganesha\nM:4/4\nL:1/8\nK:Em\nE2 G2 |";

const expectedPlaybackAttributes = [
  'data-use-container-width="true"',
  'data-hide-voice-names="true"',
  'data-copy-abcjs="true"',
  'data-min-width="min-w-[520px]"',
  'data-viewport="max-h-[800px] overflow-auto"',
];

describe("Composer result staff playback", () => {
  it("preserves harmony tab-aware render options with shared playback presentation", () => {
    const getRenderOptionsFor = vi.fn(() => ({ tablature: [{ instrument: "guitar" }] }));
    const markup = renderToStaticMarkup(
      <HarmonyStep
        melodyAbc={staffAbc}
        hasMounted={false}
        pipeline={null}
        harmonyPreview={{
          abc: staffAbc,
          rawAbc: `${staffAbc}\n%%MIDI program 1`,
          synthOptions: { voicesOff: [1] },
          layerVisibilityItems: [],
          harmonyStepComplete: true,
          getRenderOptionsFor,
        } as never}
        layerVisibility={{}}
        setLayerVisibility={noop as never}
        layerVolumes={{}}
        setLayerVolumes={noop as never}
        ws={{} as never}
        updateState={noop}
        onRestore={noop}
      />,
    );

    expect(markup).toContain(`data-abc="${staffAbc.replace(/\n/g, "\n")}"`);
    expectedPlaybackAttributes.forEach((attribute) => expect(markup).toContain(attribute));
    expect(markup).toContain('data-synth-options="{&quot;voicesOff&quot;:[1]}"');
    expect(getRenderOptionsFor).toHaveBeenCalledWith(staffAbc, expect.objectContaining({ staffwidth: 720 }));
    expect(markup).toContain('&quot;tablature&quot;:[{&quot;instrument&quot;:&quot;guitar&quot;}]');
  });

  it("preserves accompaniment tab-aware render options with shared playback presentation", () => {
    const getRenderOptionsFor = vi.fn(() => ({ tablature: [{ instrument: "guitar" }] }));
    const markup = renderToStaticMarkup(
      <AccompanimentStep
        activeAbc={staffAbc}
        branchSourceAbc={staffAbc}
        pipeline={null}
        accompanimentPreview={{
          abc: staffAbc,
          rawAbc: `${staffAbc}\n%%MIDI program 25`,
          layerVisibilityItems: [],
          appliedWorkflowStep: null,
          hasLayerVisibilityControls: false,
        } as never}
        accompLayerVisibility={{}}
        setAccompLayerVisibility={noop as never}
        accompLayerVolumes={{}}
        setAccompLayerVolumes={noop as never}
        getRenderOptionsFor={getRenderOptionsFor}
        ws={{} as never}
        updateState={noop}
      />,
    );

    expectedPlaybackAttributes.forEach((attribute) => expect(markup).toContain(attribute));
    expect(getRenderOptionsFor).toHaveBeenCalledWith(staffAbc, expect.objectContaining({ staffwidth: 900 }));
    expect(markup).toContain('&quot;tablature&quot;:[{&quot;instrument&quot;:&quot;guitar&quot;}]');
  });
});
