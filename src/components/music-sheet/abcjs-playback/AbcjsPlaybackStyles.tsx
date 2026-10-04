export function AbcjsPlaybackStyles({ resolvedCanvasId }: { resolvedCanvasId: string }) {
  return (
    <style>{`
        #${resolvedCanvasId} [data-score-item]:focus {
          outline: 2px solid #4f46e5;
          outline-offset: 4px;
        }
        #${resolvedCanvasId}:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }
        #${resolvedCanvasId} .abcjs-note,
        #${resolvedCanvasId} .abcjs-chord {
          cursor: pointer;
        }

        /* Source-linked selection; the playback highlight below wins while playing. */
        #${resolvedCanvasId} .abcjs-source-selected,
        #${resolvedCanvasId} .abcjs-source-selected * {
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
          fill: #ef4444 !important; /* Red-500 */
          font-size: 17px !important;
          filter: drop-shadow(0px 0px 4px rgba(239, 68, 68, 0.6));
        }

        #${resolvedCanvasId} .beat-medium {
          fill: #f59e0b !important; /* Amber-500 */
          font-size: 16px !important;
          filter: drop-shadow(0px 0px 3px rgba(245, 158, 11, 0.5));
        }

        #${resolvedCanvasId} .beat-soft {
          fill: #64748b !important; /* Slate-500 */
          font-size: 10px !important;
          opacity: 0.6;
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
        #${resolvedCanvasId} svg text.abcjs-annotation {
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
