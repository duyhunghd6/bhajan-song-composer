import { describe, expect, it } from "vitest";
import { buildTheoryAssistantLayerProposal } from "../theory-assistant-layer";

const melodyAbc = `X:1
T:Theory Layer Sample
M:4/4
L:1/8
Q:1/4=108
K:Em
| E2 G2 z2 B2 | B4 z2 A2 | G2 A2 B2 G2 | E8 |`;

describe("Theory Assistant Composer layer acceptance", () => {
  it("turns the constrained assistant suggestion into a separate editable Composer layer", () => {
    const proposal = buildTheoryAssistantLayerProposal(melodyAbc, {
      skillLevel: "intermediate",
      capoFret: 2,
    });

    expect(proposal).toMatchObject({
      id: "theory-assistant-intermediate-capo-2",
      name: "Theory Assistant Arrangement (Intermediate)",
      role: "harmony",
      visible: true,
    });
    expect(proposal.abc).toContain("% --- Theory Assistant: practice arrangement layer ---");
    expect(proposal.abc).toContain("% Key: Em · Meter: 4/4 · capo 2");
    expect(proposal.abc).toContain("% Chord progression:");
    expect(proposal.abc).not.toContain("T:Theory Layer Sample");
  });
});
