"use client";

import { useMemo, useState } from "react";
import MusicSheetRenderer from "@/components/music-sheet/MusicSheetRenderer";
import PianoPedalIndicator from "@/components/instruments/PianoPedalIndicator";
import { buildArrangementLayerProposals, generateArrangementPipeline } from "@/lib/theory/arrangement-pipeline";
import { buildFingerstyleComposerIntegration, FINGERSTYLE_PROFILE_OPTIONS, type FingerstyleComposerProfileId } from "./fingerstyle-integration";
import AbcEditor, { DEFAULT_ABC } from "./AbcEditor";
import TheoryAssistant from "./TheoryAssistant";
import type { ComposerStepId } from "./composer-steps";
import type { TheoryAssistantLayerProposal } from "./theory-assistant-layer";

interface ComposerStepWorkspaceProps {
  slug: string;
  step: ComposerStepId;
}

const SAMPLE_HARMONY_ABC = `% Ghosted melody context\n${DEFAULT_ABC}\n\n% Chord Track Editor\n| "Em" E2 E2 "D" G2 A2 | "C" B4 "B7" B2 A2 |`;

export default function ComposerStepWorkspace({ slug, step }: ComposerStepWorkspaceProps) {
  const [melodyAbc, setMelodyAbc] = useState(DEFAULT_ABC);
  const [acceptedHarmony, setAcceptedHarmony] = useState<TheoryAssistantLayerProposal | null>(null);
  const [engine, setEngine] = useState<"piano" | "fingerstyle">("piano");
  const [profileId, setProfileId] = useState<FingerstyleComposerProfileId>("strict-pima");
  const [generatedAccompaniment, setGeneratedAccompaniment] = useState<string | null>(null);
  const [ensembleEnabled, setEnsembleEnabled] = useState({ djembe: true, flute: true, violin: false });

  const pipeline = useMemo(() => {
    try {
      return generateArrangementPipeline(melodyAbc);
    } catch {
      return null;
    }
  }, [melodyAbc]);

  if (step === "melody") {
    return (
      <div className="space-y-5">
        <AbcEditor
          title="ABC Notation Editor"
          value={melodyAbc}
          initialAbc={DEFAULT_ABC}
          storageKey={`bhajan-song-composer:compose:${slug}:melody`}
          onChange={setMelodyAbc}
        />
      </div>
    );
  }

  if (step === "harmony") {
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI Analysis Settings</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white">
              Detect Key
            </button>
            <button type="button" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
              Set Raga
            </button>
          </div>
        </section>
        <TheoryAssistant abc={melodyAbc} onAcceptArrangement={setAcceptedHarmony} />
        {acceptedHarmony && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
            <strong>Chord Track Editor:</strong> {acceptedHarmony.name} accepted as the harmony layer.
          </section>
        )}
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Chord Track Editor (Ghosted Melody below)</h2>
          <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-zinc-500 dark:text-zinc-400">{SAMPLE_HARMONY_ABC}</pre>
        </section>
      </div>
    );
  }

  if (step === "accompaniment") {
    const generateAccompaniment = () => {
      if (engine === "fingerstyle") {
        setGeneratedAccompaniment(buildFingerstyleComposerIntegration(melodyAbc, undefined, { pickingProfile: profileId }).composerLayer.abc);
      } else {
        setGeneratedAccompaniment(pipeline?.accompaniment.abc ?? "V:Piano clef=treble name=\"Generated Piano\"\n| [EGB]4 [DFA]4 |");
      }
    };

    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Engine Toggle</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <input type="radio" checked={engine === "piano"} onChange={() => setEngine("piano")} /> Piano Accomp.
            </label>
            <label className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <input type="radio" checked={engine === "fingerstyle"} onChange={() => setEngine("fingerstyle")} /> Fingerstyle
            </label>
            <select
              aria-label="Profile"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value as FingerstyleComposerProfileId)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              {FINGERSTYLE_PROFILE_OPTIONS.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.label}</option>
              ))}
            </select>
            <button type="button" onClick={generateAccompaniment} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">
              Generate Accompaniment Matrix
            </button>
          </div>
        </section>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Playability Validation Report</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">⚠️ Max span exceeded in m.4. Converted to arpeggio when required.</p>
        </section>
        <MusicSheetRenderer
          abcString={generatedAccompaniment ?? pipeline?.accompaniment.abc ?? melodyAbc}
          title="Resulting ABC Staff Preview"
          canvasId="composer-accompaniment-preview"
          controls={false}
          showLoopControls={false}
        />
      </div>
    );
  }

  if (step === "ensemble") {
    const proposals = pipeline ? buildArrangementLayerProposals(pipeline) : [];
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Enable Layers</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {(["djembe", "flute", "violin"] as const).map((layer) => (
              <label key={layer} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 capitalize dark:border-zinc-800 dark:bg-zinc-900">
                <input
                  type="checkbox"
                  checked={ensembleEnabled[layer]}
                  onChange={() => setEnsembleEnabled((current) => ({ ...current, [layer]: !current[layer] }))}
                /> {layer}
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/30">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Conflict Resolution Hierarchy Log</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Flute yielded in m.8 due to active melody; Djembe follows bass/kick alignment.</p>
        </section>
        <MusicSheetRenderer
          abcString={pipeline?.finalAbc ?? (proposals.map((proposal) => proposal.abc).join("\n\n") || melodyAbc)}
          title="Multi-track ABCJS Render (Full Score View)"
          canvasId="composer-ensemble-preview"
          controls={false}
          showLoopControls={false}
        />
      </div>
    );
  }

  const markdown = `---\ntitle: "${slug}"\nslug: "${slug}"\nabcNotations:\n  - type: "melody"\n    label: "Melody Music Sheet"\n---\n\n## Lyrics\n\nDraft lyrics...\n\n## ABC\n\n\`\`\`abc\n${melodyAbc}\n\`\`\``;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Playback Simulation: Test Full Audio & Sync</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">Play All Layers</button>
          <PianoPedalIndicator
            title="Sustain Pedal Indicator"
            pedalAutomation={{
              controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
              events: [{ measureIndex: 0, beat: 1, chord: "Em", type: "pedal-down", value: 127 }],
            }}
          />
        </div>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Raw Markdown Output File Preview</h2>
        <textarea readOnly value={markdown} className="mt-3 min-h-72 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">Copy Markdown</button>
          <button type="button" className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Submit as PR</button>
        </div>
      </section>
    </div>
  );
}
