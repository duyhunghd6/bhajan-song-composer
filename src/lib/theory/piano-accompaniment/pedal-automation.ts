import type { PianoPedalAutomation, PianoPedalEvent, PianoPedalEventMetadata } from "./types";

export function buildPedalAutomation(chords: { chordName: string }[], beatCount: number): PianoPedalAutomation {
  const events: PianoPedalEvent[] = [];

  chords.forEach((chord, measureIndex) => {
    const previousChord = chords[measureIndex - 1]?.chordName;
    if (measureIndex === 0) {
      events.push({ measureIndex, beat: 1, chord: chord.chordName, type: "pedal-down", value: 127 });
      return;
    }

    if (previousChord !== chord.chordName) {
      events.push({
        measureIndex,
        beat: 1,
        chord: chord.chordName,
        type: "pedal-flush",
        value: 0,
        previousChord,
      });
      events.push({ measureIndex, beat: 1, chord: chord.chordName, type: "pedal-down", value: 127 });
    }
  });

  const lastChord = chords.at(-1);
  if (lastChord) {
    events.push({
      measureIndex: chords.length - 1,
      beat: beatCount,
      chord: lastChord.chordName,
      type: "pedal-up",
      value: 0,
    });
  }

  return {
    controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
    events,
  };
}

export function buildPedalEventMetadata(pedalAutomation: PianoPedalAutomation): PianoPedalEventMetadata[] {
  return pedalAutomation.events.map((event) => {
    const state = event.type.replace("pedal-", "") as PianoPedalEventMetadata["state"];
    const label = event.type === "pedal-down"
      ? "Pedal Down"
      : event.type === "pedal-flush"
        ? "Pedal Flush"
        : "Pedal Up";

    return {
      measureIndex: event.measureIndex,
      beat: event.beat,
      chord: event.chord,
      controller: "sustain",
      midiControlChange: pedalAutomation.controller.midiControlChange,
      state,
      value: event.value,
      ...(event.previousChord ? { previousChord: event.previousChord } : {}),
      label,
    };
  });
}
