import { describe, expect, it } from "vitest";
import { buildFingerstyleComposerIntegration } from "../fingerstyle-integration";

const sampleAbc = `X:1
T:Namostute
M:4/4
L:1/8
Q:1/4=120
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`;

describe("fingerstyle Composer integration", () => {
  it("builds a Composer layer, playability inspection, and synchronized visual markers for the selected profile", () => {
    const integration = buildFingerstyleComposerIntegration(sampleAbc, ["Em", "Bm", "G", "Em"], {
      pickingProfile: "folk-travis",
    });

    expect(integration.selectedProfile).toMatchObject({
      id: "folk-travis",
      label: "Folk / Travis Override",
    });
    expect(integration.composerLayer).toMatchObject({
      id: "fingerstyle-guitar-folk-travis",
      name: "Fingerstyle Guitar (Folk / Travis Override)",
      role: "custom",
      visible: true,
    });
    expect(integration.composerLayer.abc).toContain("T:Fingerstyle Guitar (Folk / Travis Override)");
    expect(integration.composerLayer.abc).toContain('V:Guitar clef=treble-8 name="Layer 2 Guitar Fingerstyle"');
    expect(integration.composerLayer.abc).toContain("%%MIDI program 24");
    expect(integration.composerLayer.abc).toContain("[E,E]2 E2 [B,G]2 A2");
    expect(integration.composerLayer.abc).toContain("[B,B]2 B2 [^F,B]2 A2");
    expect(integration.arrangement.outputContract.artifacts.formPlan.sections.map((section) => section.kind)).toEqual([
      "intro",
      "body",
      "interlude",
      "outro",
    ]);
    expect(integration.arrangement.outputContract.artifacts.guitarTabEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1, role: "melody" }),
        expect.objectContaining({ measureIndex: 0, beat: 1, role: "bass" }),
        expect.objectContaining({ measureIndex: 0, beat: 3, role: "fifth" }),
      ])
    );

    expect(integration.playability).toMatchObject({
      status: "ready_for_integration",
      valid: true,
      maxFretSpan: 5,
      failedConstraints: [],
    });

    expect(integration.fretboard.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ string: 6, fret: 0, note: "E2", tone: "bass" }),
        expect.objectContaining({ string: 1, fret: 0, note: "E4", tone: "melody" }),
      ])
    );
    expect(integration.noteMarkers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fingerstyle-picking-0-1-thumb-clock-6-0",
          hand: "right",
          fingerNumber: 1,
          noteLabel: "string 6 fret 0",
          techniqueLabel: "thumb-clock (p)",
          measureIndex: 0,
          beat: 1,
        }),
        expect.objectContaining({
          id: "fingerstyle-fretting-1-1-thumb-clock-5-2",
          hand: "left",
          fingerNumber: 1,
          noteLabel: "string 5 fret 2",
          measureIndex: 1,
          beat: 1,
        }),
      ])
    );
  });

  it("keeps strict PIMA output integration-ready without requiring Travis-only thumb clock events", () => {
    const integration = buildFingerstyleComposerIntegration(sampleAbc, ["Em", "Bm", "G", "Em"], {
      pickingProfile: "strict-pima",
    });

    expect(integration.selectedProfile).toMatchObject({
      id: "strict-pima",
      label: "Strict PIMA",
    });
    expect(integration.playability).toMatchObject({
      status: "ready_for_integration",
      valid: true,
      failedConstraints: [],
    });
    expect(integration.noteMarkers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fingerstyle-picking-0-1-pinch-1-0",
          hand: "right",
          fingerNumber: 4,
          techniqueLabel: "pinch (a)",
          noteLabel: "string 1 fret 0",
        }),
        expect.objectContaining({
          id: "fingerstyle-picking-0-2-guide-tone-1-0",
          hand: "right",
          fingerNumber: 4,
          techniqueLabel: "guide-tone (a)",
          noteLabel: "string 1 fret 0",
        }),
      ])
    );
  });
});
