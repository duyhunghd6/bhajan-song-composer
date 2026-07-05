export function AbcjsPlaybackStyles({ resolvedCanvasId }: { resolvedCanvasId: string }) {
  return (
      <style>{`
        #${resolvedCanvasId} .abcjs-note,
        #${resolvedCanvasId} .abcjs-chord {
          cursor: pointer;
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

        /* Style chords above notes */
        #${resolvedCanvasId} svg text.abcjs-chord {
          transform: translateY(-6px);
          font-size: 13px !important;
          font-weight: 600 !important;
          fill: #a5b4fc !important; /* Indigo-300 style chord */
        }

        /* Pull tablature staff up ONLY on the first system (g.abcjs-l0) to prevent overlaps on subsequent compact lines */
        /* Pull tablature staff up when beat indicators AND lyrics are present */
        #${resolvedCanvasId}.has-beat-indicators.has-lyrics g.abcjs-l0.abcjs-tablature-staff,
        #${resolvedCanvasId}.has-beat-indicators.has-lyrics g.abcjs-l0.abcjs-tabNumber,
        #${resolvedCanvasId}.has-beat-indicators.has-lyrics g.abcjs-l0.abcjs-symbol:has(path[data-name="tab.big"]) {
          transform: translateY(-60px);
        }

        /* Keep default tablature spacing for beat-only rows so Melody, beat icons, and TAB stay separated */
        #${resolvedCanvasId}.has-beat-indicators.no-lyrics g.abcjs-l0.abcjs-tablature-staff,
        #${resolvedCanvasId}.has-beat-indicators.no-lyrics g.abcjs-l0.abcjs-tabNumber,
        #${resolvedCanvasId}.has-beat-indicators.no-lyrics g.abcjs-l0.abcjs-symbol:has(path[data-name="tab.big"]) {
          transform: translateY(0);
        }

        /* Pull tablature staff up when NO beat indicators are present but lyrics are present */
        #${resolvedCanvasId}:not(.has-beat-indicators).has-lyrics g.abcjs-l0.abcjs-tablature-staff,
        #${resolvedCanvasId}:not(.has-beat-indicators).has-lyrics g.abcjs-l0.abcjs-tabNumber,
        #${resolvedCanvasId}:not(.has-beat-indicators).has-lyrics g.abcjs-l0.abcjs-symbol:has(path[data-name="tab.big"]) {
          transform: translateY(-50px);
        }

        /* Keep default spacing (no pull up) when NO beat indicators and NO lyrics are present */
        #${resolvedCanvasId}:not(.has-beat-indicators).no-lyrics g.abcjs-l0.abcjs-tablature-staff,
        #${resolvedCanvasId}:not(.has-beat-indicators).no-lyrics g.abcjs-l0.abcjs-tabNumber,
        #${resolvedCanvasId}:not(.has-beat-indicators).no-lyrics g.abcjs-l0.abcjs-symbol:has(path[data-name="tab.big"]) {
          transform: translateY(0);
        }
      `}</style>
  );
}
