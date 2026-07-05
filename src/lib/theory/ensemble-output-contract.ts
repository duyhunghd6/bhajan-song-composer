import { AccompanimentStage } from "./accompaniment-stage";
import { extractMusicBodyLines, splitAbcMeasureSegments } from "./abc-duration";
import {
  DjembeArrangement,
  DjembeEvent,
  DjembeStroke,
  generateDjembeArrangement,
} from "./djembe-arranger";
import {
  EnsembleConflictReportEntry,
  EnsembleConflictResolution,
  resolveEnsembleConflicts,
} from "./ensemble-conflicts";
import {
  EnsembleIntegrationHandshake,
  generateEnsembleIntegrationHandshake,
} from "./ensemble-expander";
import {
  FluteBreathEvent,
  generateOrchestralSupport,
  OrchestralSupportArrangement,
  OrchestralSupportEvent,
  OrchestralSupportMode,
  ViolinExpressionEvent,
} from "./orchestral-arranger";
import type { EnsembleGenerationPlan } from "./ensemble-workflow";

export type EnsemblePlaybackInstrument = "djembe" | "flute" | "violin";
export type EnsembleVisualInstrument = EnsemblePlaybackInstrument;

export interface EnsembleExpansionOutputOptions {
  accompaniment: AccompanimentStage;
  handshake?: EnsembleIntegrationHandshake;
  djembe?: DjembeArrangement;
  orchestral?: OrchestralSupportArrangement;
  plan?: EnsembleGenerationPlan;
}

export interface EnsembleEventMaps {
  djembe: DjembeEvent[];
  flute: OrchestralSupportEvent[];
  violin: OrchestralSupportEvent[];
  fluteBreath: FluteBreathEvent[];
  violinExpression: ViolinExpressionEvent[];
}

export interface EnsembleAbcLayers {
  layer3Djembe: string;
  layer3Flute: string;
  layer3Violin: string;
  combined: string;
}

export interface EnsemblePlaybackEvent {
  layer: 3;
  instrument: EnsemblePlaybackInstrument;
  measureIndex: number;
  beat: number;
  startMs: number;
  durationMs: number;
  midi: number;
  note: string;
  velocity: number;
  source: DjembeEvent["source"] | OrchestralSupportEvent["source"];
}

export interface EnsembleVisualActivityEvent {
  layer: 3;
  instrument: EnsembleVisualInstrument;
  measureIndex: number;
  beat: number;
  startMs: number;
  durationMs: number;
  active: boolean;
  label: string;
  density?: EnsembleIntegrationHandshake["rhythmicDensityGrid"][number]["density"];
  mode?: OrchestralSupportMode;
}

export interface EnsembleMidiControlEvent extends ViolinExpressionEvent {
  layer: 3;
}

export interface EnsemblePlaybackSyncGroup {
  measureIndex: number;
  beat: number;
  startMs: number;
  instruments: EnsemblePlaybackInstrument[];
  events: EnsemblePlaybackEvent[];
  visualActivity: EnsembleVisualActivityEvent[];
}

export interface EnsembleExpansionValidation {
  handshakeReady: boolean;
  eventMapsReady: boolean;
  abcLayersReady: boolean;
  playbackEventsReady: boolean;
  midiControlEventsReady: boolean;
  visualActivityReady: boolean;
  layerHierarchyReady: boolean;
  playbackSyncGroupsReady: boolean;
}

export interface EnsembleLayerHierarchyEntry {
  layer: 1 | 2 | 3;
  role: "primary-melody" | "accompaniment-foundation" | "ensemble-support";
  instruments: string[];
  priority: 1 | 2 | 3;
  conflictPolicy:
    | "preserve-primary-melody"
    | "preserve-rhythmic-and-harmonic-foundation"
    | "flatten-melodic-runs-before-removing-percussion-fills";
}

export interface EnsembleExpansionOutput {
  handshake: EnsembleIntegrationHandshake;
  djembe: DjembeArrangement;
  orchestral: OrchestralSupportArrangement;
  conflicts: EnsembleConflictResolution;
  eventMaps: EnsembleEventMaps;
  yieldDecisions: OrchestralSupportArrangement["yieldDecisions"];
  conflictReport: EnsembleConflictReportEntry[];
  layerHierarchy: EnsembleLayerHierarchyEntry[];
  abcLayers: EnsembleAbcLayers;
  playbackEvents: EnsemblePlaybackEvent[];
  playbackSyncGroups: EnsemblePlaybackSyncGroup[];
  midiControlEvents: EnsembleMidiControlEvent[];
  visualActivity: EnsembleVisualActivityEvent[];
  validation: EnsembleExpansionValidation;
}

const DJEMBE_MIDI_BY_STROKE: Record<DjembeStroke, number> = {
  bass: 64,
  "mid-tone": 63,
  slap: 62,
};

const ORCHESTRAL_MIDI_PROGRAM_BY_VOICE: Record<"Flute" | "Violin", number> = {
  Flute: 73,
  Violin: 40,
};

function noteToAbc(note: string): string {
  const match = note.match(/^([A-G])(#?)(\d)$/);
  if (!match) return note;

  const [, pitch, accidental, octaveText] = match;
  const octave = Number(octaveText);
  const accidentalPrefix = accidental === "#" ? "^" : "";

  if (octave <= 3) return `${accidentalPrefix}${pitch},`;
  if (octave === 4) return `${accidentalPrefix}${pitch}`;
  return `${accidentalPrefix}${pitch.toLowerCase()}${"'".repeat(Math.max(0, octave - 5))}`;
}

function melodyMeasureLinePattern(melodyAbc: string): number[] {
  return extractMusicBodyLines(melodyAbc)
    .map((line) => splitAbcMeasureSegments(line).length)
    .filter((count) => count > 0);
}

function formatMeasuresByStaffSystem(measures: string[], pattern: number[]): string[] {
  const effectivePattern = pattern.length > 0 ? pattern : [Math.max(measures.length, 1)];
  const lines: string[] = [];
  let cursor = 0;

  for (const count of effectivePattern) {
    const group = measures.slice(cursor, cursor + count);
    if (group.length === 0) break;
    lines.push(`| ${group.join(" | ")} |`);
    cursor += count;
  }

  if (cursor < measures.length) {
    lines.push(`| ${measures.slice(cursor).join(" | ")} |`);
  }

  return lines;
}

function regroupVoiceAbcByStaffSystem(voiceAbc: string, pattern: number[]): string {
  const lines = voiceAbc.split(/\r?\n/);
  const voiceLine = lines[0]?.trim();
  if (!voiceLine?.startsWith("V:")) return voiceAbc;

  const directiveLines = lines.slice(1).filter((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("%%") || trimmed.startsWith("%");
  });
  const musicMeasures = splitAbcMeasureSegments(extractMusicBodyLines(voiceAbc).join(" "));

  if (musicMeasures.length === 0) return voiceAbc;

  return [
    voiceLine,
    ...directiveLines,
    "% Layer 3 voice is split to match the source Melody staff-system line pattern.",
    ...formatMeasuresByStaffSystem(musicMeasures, pattern),
  ].join("\n");
}

function buildOrchestralLayerAbc(
  voiceName: "Flute" | "Violin",
  events: OrchestralSupportEvent[],
  measureCount: number,
  pattern: number[]
): string {
  const measures = Array.from({ length: measureCount }, (_, measureIndex) => {
    const notes = events
      .filter((event) => event.measureIndex === measureIndex)
      .sort((a, b) => a.beat - b.beat)
      .map((event) => `${noteToAbc(event.note)}2`);

    return notes.length > 0 ? notes.join(" ") : "z8";
  });

  return [
    `V:${voiceName} name="Layer 3 ${voiceName} Support"`,
    `%%MIDI program ${ORCHESTRAL_MIDI_PROGRAM_BY_VOICE[voiceName]}`,
    "% Layer 3 voice is split to match the source Melody staff-system line pattern.",
    ...formatMeasuresByStaffSystem(measures, pattern),
  ].join("\n");
}

function buildAbcLayers(
  djembe: DjembeArrangement,
  orchestral: OrchestralSupportArrangement,
  measureCount: number,
  melodyAbc: string
): EnsembleAbcLayers {
  const pattern = melodyMeasureLinePattern(melodyAbc);
  const layer3Djembe = regroupVoiceAbcByStaffSystem(djembe.abc, pattern);
  const layer3Flute = buildOrchestralLayerAbc("Flute", orchestral.fluteSupportMap, measureCount, pattern);
  const layer3Violin = buildOrchestralLayerAbc("Violin", orchestral.violinSupportMap, measureCount, pattern);

  return {
    layer3Djembe,
    layer3Flute,
    layer3Violin,
    combined: [layer3Djembe, layer3Flute, layer3Violin].join("\n"),
  };
}

function buildPlaybackEvents(
  djembe: DjembeArrangement,
  orchestral: OrchestralSupportArrangement
): EnsemblePlaybackEvent[] {
  const djembeEvents = djembe.eventMap.map<EnsemblePlaybackEvent>((event) => ({
    layer: 3,
    instrument: "djembe",
    measureIndex: event.measureIndex,
    beat: event.beat,
    startMs: event.startMs,
    durationMs: event.durationMs,
    midi: DJEMBE_MIDI_BY_STROKE[event.stroke],
    note: event.stroke,
    velocity: event.velocity,
    source: event.source,
  }));
  const fluteEvents = orchestral.fluteSupportMap.map<EnsemblePlaybackEvent>((event) => ({
    layer: 3,
    instrument: "flute",
    measureIndex: event.measureIndex,
    beat: event.beat,
    startMs: event.startMs,
    durationMs: event.durationMs,
    midi: event.midiNote,
    note: event.note,
    velocity: event.velocity,
    source: event.source,
  }));
  const violinEvents = orchestral.violinSupportMap.map<EnsemblePlaybackEvent>((event) => ({
    layer: 3,
    instrument: "violin",
    measureIndex: event.measureIndex,
    beat: event.beat,
    startMs: event.startMs,
    durationMs: event.durationMs,
    midi: event.midiNote,
    note: event.note,
    velocity: event.velocity,
    source: event.source,
  }));

  return [...djembeEvents, ...fluteEvents, ...violinEvents].sort((a, b) =>
    a.measureIndex - b.measureIndex || a.startMs - b.startMs || a.instrument.localeCompare(b.instrument)
  );
}

function activityDensity(
  handshake: EnsembleIntegrationHandshake,
  event: Pick<EnsemblePlaybackEvent, "measureIndex" | "startMs">
): EnsembleVisualActivityEvent["density"] {
  return handshake.rhythmicDensityGrid.find((slice) =>
    slice.measureIndex === event.measureIndex && slice.startMs === event.startMs
  )?.density;
}

function buildVisualActivity(
  handshake: EnsembleIntegrationHandshake,
  djembe: DjembeArrangement,
  orchestral: OrchestralSupportArrangement
): EnsembleVisualActivityEvent[] {
  const djembeActivity = djembe.eventMap.map<EnsembleVisualActivityEvent>((event) => ({
    layer: 3,
    instrument: "djembe",
    measureIndex: event.measureIndex,
    beat: event.beat,
    startMs: event.startMs,
    durationMs: event.durationMs,
    active: true,
    label: `Djembe ${event.stroke}`,
    density: activityDensity(handshake, event),
  }));
  const fluteActivity = orchestral.fluteSupportMap.map<EnsembleVisualActivityEvent>((event) => ({
    layer: 3,
    instrument: "flute",
    measureIndex: event.measureIndex,
    beat: event.beat,
    startMs: event.startMs,
    durationMs: event.durationMs,
    active: true,
    label: `Flute ${event.mode}`,
    density: activityDensity(handshake, event),
    mode: event.mode,
  }));
  const violinActivity = orchestral.violinSupportMap.map<EnsembleVisualActivityEvent>((event) => ({
    layer: 3,
    instrument: "violin",
    measureIndex: event.measureIndex,
    beat: event.beat,
    startMs: event.startMs,
    durationMs: event.durationMs,
    active: true,
    label: `Violin ${event.mode}`,
    density: activityDensity(handshake, event),
    mode: event.mode,
  }));

  return [...djembeActivity, ...fluteActivity, ...violinActivity].sort((a, b) =>
    a.measureIndex - b.measureIndex || a.startMs - b.startMs || a.instrument.localeCompare(b.instrument)
  );
}

function buildMidiControlEvents(orchestral: OrchestralSupportArrangement): EnsembleMidiControlEvent[] {
  return orchestral.violinExpressionMap.map((event) => ({
    ...event,
    layer: 3,
  }));
}

function buildPlaybackSyncGroups(
  playbackEvents: EnsemblePlaybackEvent[],
  visualActivity: EnsembleVisualActivityEvent[]
): EnsemblePlaybackSyncGroup[] {
  const groupedEvents = playbackEvents.reduce((groups, event) => {
    const key = `${event.measureIndex}:${event.startMs}`;
    const events = groups.get(key) ?? [];
    events.push(event);
    groups.set(key, events);
    return groups;
  }, new Map<string, EnsemblePlaybackEvent[]>());

  return Array.from(groupedEvents.values())
    .map((events) => {
      const first = events[0];
      const activity = visualActivity.filter((event) =>
        event.measureIndex === first.measureIndex && event.startMs === first.startMs
      );

      return {
        measureIndex: first.measureIndex,
        beat: first.beat,
        startMs: first.startMs,
        instruments: events.map((event) => event.instrument),
        events,
        visualActivity: activity,
      };
    })
    .sort((a, b) => a.measureIndex - b.measureIndex || a.startMs - b.startMs);
}

function buildLayerHierarchy(accompaniment: AccompanimentStage): EnsembleLayerHierarchyEntry[] {
  return [
    {
      layer: 1,
      role: "primary-melody",
      instruments: ["voice"],
      priority: 1,
      conflictPolicy: "preserve-primary-melody",
    },
    {
      layer: 2,
      role: "accompaniment-foundation",
      instruments: [accompaniment.layer.instrument],
      priority: 2,
      conflictPolicy: "preserve-rhythmic-and-harmonic-foundation",
    },
    {
      layer: 3,
      role: "ensemble-support",
      instruments: ["djembe", "flute", "violin"],
      priority: 3,
      conflictPolicy: "flatten-melodic-runs-before-removing-percussion-fills",
    },
  ];
}

function validateOutput(
  output: Pick<EnsembleExpansionOutput, "handshake" | "eventMaps" | "abcLayers" | "playbackEvents" | "playbackSyncGroups" | "midiControlEvents" | "visualActivity" | "layerHierarchy">
): EnsembleExpansionValidation {
  return {
    handshakeReady: output.handshake.layerPrerequisites.layer1Melody && output.handshake.layerPrerequisites.layer2Foundation,
    eventMapsReady: output.eventMaps.djembe.length > 0 && output.eventMaps.flute.length > 0 && output.eventMaps.violin.length > 0,
    abcLayersReady: Object.values(output.abcLayers).every((abc) => abc.trim().length > 0),
    playbackEventsReady: output.playbackEvents.length > 0,
    midiControlEventsReady: output.midiControlEvents.length > 0,
    visualActivityReady: output.visualActivity.length > 0,
    layerHierarchyReady: output.layerHierarchy.length === 3,
    playbackSyncGroupsReady: output.playbackSyncGroups.length > 0,
  };
}

export function generateEnsembleExpansionOutput(
  melodyAbc: string,
  options: EnsembleExpansionOutputOptions
): EnsembleExpansionOutput {
  const { accompaniment, plan } = options;
  const handshake = options.handshake ?? generateEnsembleIntegrationHandshake(melodyAbc, { accompaniment });
  const sourceDjembe = options.djembe ?? generateDjembeArrangement(melodyAbc, { accompaniment, handshake, plan: plan?.djembe });
  const sourceOrchestral = options.orchestral ?? generateOrchestralSupport(melodyAbc, { accompaniment, handshake, plan: plan ? { flute: plan.flute, violin: plan.violin } : undefined });
  const conflicts = resolveEnsembleConflicts({
    handshake,
    djembe: sourceDjembe,
    orchestral: sourceOrchestral,
  });
  const djembe = conflicts.djembe;
  const orchestral = conflicts.orchestral;
  const eventMaps: EnsembleEventMaps = {
    djembe: djembe.eventMap,
    flute: orchestral.fluteSupportMap,
    violin: orchestral.violinSupportMap,
    fluteBreath: orchestral.fluteBreathMap,
    violinExpression: orchestral.violinExpressionMap,
  };
  const abcLayers = buildAbcLayers(djembe, orchestral, accompaniment.measures.length, melodyAbc);
  const playbackEvents = buildPlaybackEvents(djembe, orchestral);
  const midiControlEvents = buildMidiControlEvents(orchestral);
  const visualActivity = buildVisualActivity(handshake, djembe, orchestral);
  const playbackSyncGroups = buildPlaybackSyncGroups(playbackEvents, visualActivity);
  const layerHierarchy = buildLayerHierarchy(accompaniment);
  const output = {
    handshake,
    djembe,
    orchestral,
    conflicts,
    eventMaps,
    yieldDecisions: orchestral.yieldDecisions,
    conflictReport: conflicts.report,
    layerHierarchy,
    abcLayers,
    playbackEvents,
    playbackSyncGroups,
    midiControlEvents,
    visualActivity,
  };

  return {
    ...output,
    validation: validateOutput(output),
  };
}
