type NoteTimingEvent = {
  milliseconds: number;
  type?: string;
  startChar?: number;
  endChar?: number;
  elements?: HTMLElement[][];
};

export type MusicSheetPlaybackCursorEvent = {
  cursorSeconds: number;
  startChar?: number;
  endChar?: number;
  abcEvent: NoteTimingEvent;
};

export function buildMusicSheetPlaybackCursorEvent(
  event: NoteTimingEvent
): MusicSheetPlaybackCursorEvent {
  return {
    abcEvent: event,
    cursorSeconds: event.milliseconds / 1000,
    startChar: event.startChar,
    endChar: event.endChar,
  };
}
