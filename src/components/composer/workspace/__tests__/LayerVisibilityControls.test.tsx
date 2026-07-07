import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LayerVisibilityControls } from "../LayerVisibilityControls";

const items = [
  { id: "Melody", label: "Melody", kind: "voice" as const, defaultVisible: true, enabled: true, supportsVolume: true },
  { id: "Guitar", label: "Guitar", kind: "voice" as const, defaultVisible: true, enabled: true, supportsVolume: true },
  { id: "Piano", label: "Piano", kind: "voice" as const, defaultVisible: true, enabled: true, supportsVolume: true },
  { id: "Flute", label: "Flute", kind: "voice" as const, defaultVisible: true, enabled: true, supportsVolume: true },
];

describe("LayerVisibilityControls", () => {
  it("lays out layer controls in four columns on wide screens", () => {
    const html = renderToStaticMarkup(
      <LayerVisibilityControls
        items={items}
        visibility={{}}
        onVisibilityChange={() => undefined}
        volumes={{}}
        onVolumeChange={() => undefined}
      />
    );

    expect(html).toContain("grid-template-columns:repeat(6, minmax(0, 1fr))");
    expect(html).not.toContain("grid-cols-4");
    expect(html).not.toContain("sm:grid-cols-2");
    expect(html).not.toContain("xl:grid-cols-3");
  });
});
