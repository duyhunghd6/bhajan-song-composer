export function AbcjsPlaybackStyles({ resolvedCanvasId }: { resolvedCanvasId: string }) {
  return (
    <style>{`
        #${resolvedCanvasId} [data-score-item]:focus {
          outline: 2px solid #4f46e5;
          outline-offset: 4px;
        }
        #${resolvedCanvasId}:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }
        #${resolvedCanvasId} .abcjs-note,
        #${resolvedCanvasId} .abcjs-chord,
        #${resolvedCanvasId} .guitar-chord-hit-area,
        #${resolvedCanvasId} [data-guitar-chord] {
          cursor: pointer;
        }
        #${resolvedCanvasId} .guitar-chord-hit-area:hover {
          fill: rgba(99, 102, 241, 0.12);
          stroke: rgba(79, 70, 229, 0.55);
          stroke-width: 1.5px;
        }
        #${resolvedCanvasId} .abcjs-chord[data-guitar-chord]:hover,
        #${resolvedCanvasId} svg[data-guitar-chord]:hover {
          filter: drop-shadow(0 0 3px rgba(79, 70, 229, 0.75));
        }
        #${resolvedCanvasId} .guitar-chord-hit-area:focus-visible,
        #${resolvedCanvasId} [data-guitar-chord]:focus-visible {
          outline: none;
          fill: rgba(99, 102, 241, 0.16);
          stroke: #4f46e5;
          stroke-width: 2px;
        }

        /* Source-linked selection; the playback highlight below wins while playing. */
        #${resolvedCanvasId} .abcjs-source-selected:not([data-score-selection-owned="true"] *),
        #${resolvedCanvasId} .abcjs-source-selected:not([data-score-selection-owned="true"] *) * {
          fill: #4f46e5 !important;
          stroke: #4f46e5 !important;
        }

        #${resolvedCanvasId} .abcjs-note-active,
        #${resolvedCanvasId} .abcjs-note-active * {
          fill: #f59e0b !important;
          stroke: #f59e0b !important;
        }

        #${resolvedCanvasId} .beat-indicator {
          font-family: sans-serif !important;
          font-weight: 800 !important;
          alignment-baseline: middle !important;
          text-anchor: middle !important;
          transition: all 0.3s ease;
        }

        #${resolvedCanvasId} .beat-strong {
          fill: #000 !important;
          font-size: 17px !important;
        }

        #${resolvedCanvasId} .beat-medium {
          fill: #000 !important;
          font-size: 12px !important;
        }

        #${resolvedCanvasId} .beat-soft {
          fill: #000 !important;
          font-size: 10px !important;
          opacity: 1;
        }

        /* Style chords above notes — position is handled by postProcessChords() */
        #${resolvedCanvasId} svg text.abcjs-chord {
          font-size: 13px !important;
          font-weight: 600 !important;
          fill: #a5b4fc !important; /* Indigo-300 */
        }

        /* 
         * ABCJS Tablature Rendering and String Mapping Rules:
         * We prepend ABC notes with !N! (e.g. !1!b) to force them to specific guitar strings
         * for the Tablature staff. However, ABCJS also renders these decorations as visual
         * string indicator numbers above the standard treble staff notes.
         * We hide them here to prevent visual clutter on the standard notation staff.
         */
        #${resolvedCanvasId} svg text.abcjs-annotation:not([data-strumming-technique]) {
          display: none;
        }

        /* Shrink fret numbers inside TAB staves for a cleaner look */
        #${resolvedCanvasId} svg g.abcjs-tabNumber text {
          font-size: 12px !important;
        }

        /* Legal discretionary-fill windows; rendered by the playback overlay only. */
        #${resolvedCanvasId} .abcjs-fill-opportunity-dot {
          fill: #ef4444;
          stroke: #fff;
          stroke-width: 1.5px;
          filter: drop-shadow(0 0 2px rgba(127, 29, 29, 0.75));
        }
      `}</style>
  );
}
