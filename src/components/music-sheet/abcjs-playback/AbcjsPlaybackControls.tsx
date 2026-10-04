import styles from "./playback-controls.module.css";
import ui from "@/components/ui/controls.module.css";
import { Button } from "@/components/ui/Button";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { MusicSheetLoopMode } from "../playback";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface AbcjsPlaybackControlsProps {
  actions?: ReactNode;
  controls: boolean;
  showLoopControls: boolean;
  isPlaying: boolean;
  stopSynth: () => void;
  playSynth: () => void;
  pauseSynth: () => void;
  loopMode: MusicSheetLoopMode;
  setLoopMode: Dispatch<SetStateAction<MusicSheetLoopMode>>;
  currentSeconds: number;
  durationSeconds: number;
  overrideKey: string;
  parsedKey: string;
  setOverrideKey: Dispatch<SetStateAction<string>>;
  overrideMeter: string;
  parsedMeter: string;
  setOverrideMeter: Dispatch<SetStateAction<string>>;
  tempo: number;
  setTempo: Dispatch<SetStateAction<number>>;
  totalMeasures: number;
  loopStartMeasure: number;
  setLoopStartMeasure: Dispatch<SetStateAction<number>>;
  loopEndMeasure: number;
  setLoopEndMeasure: Dispatch<SetStateAction<number>>;
}

export function AbcjsPlaybackControls({
  actions,
  controls,
  showLoopControls,
  isPlaying,
  stopSynth,
  playSynth,
  pauseSynth,
  loopMode,
  setLoopMode,
  currentSeconds,
  durationSeconds,
  overrideKey,
  parsedKey,
  setOverrideKey,
  overrideMeter,
  parsedMeter,
  setOverrideMeter,
  tempo,
  setTempo,
  totalMeasures,
  loopStartMeasure,
  setLoopStartMeasure,
  loopEndMeasure,
  setLoopEndMeasure,
}: AbcjsPlaybackControlsProps) {
  return (
        <div data-ui-tone="inverse" role="group" aria-label="Playback controls" className={styles.toolbar}>
          {/* Left: Transport & Time */}
          <div className={styles.transport}>
            <div className={styles.buttons}>
              <Button variant="ghost" size="sm" iconOnly type="button"
                id="midi-btn-stop"
                onClick={stopSynth}

                aria-label="Rewind to start"
                title="Rewind to start"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </Button>
              {!isPlaying ? (
                <Button variant="ghost" size="sm" iconOnly type="button"
                  id="midi-btn-play"
                  onClick={playSynth}

                  aria-label="Play"
                  title="Play"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </Button>
              ) : (
                <Button variant="ghost" size="sm" iconOnly type="button"
                  id="midi-btn-pause"
                  onClick={pauseSynth}

                  aria-label="Pause"
                  title="Pause"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                </Button>
              )}
              {showLoopControls && (
                <Button variant="ghost" size="sm" iconOnly aria-pressed={loopMode === "range"} type="button"
                  onClick={() => setLoopMode(loopMode === 'range' ? 'whole' : 'range')}

                  title="Toggle Loop Range"
                >
                  <span className="sr-only">{loopMode === "range" ? "Measure range" : "Whole sheet"}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </Button>
              )}
            </div>

            <span className={styles.time}>
              {formatTime(currentSeconds)} / {formatTime(durationSeconds)}
            </span>
          </div>

          {/* Right: Metadata dropdowns, BPM, & Loop range sliders */}
          <div className={styles.settings}>
            {actions}
            {controls && (
              <div className={styles.metadata} title="Sheet Metadata Overrides">
                <label >
                  KEY: 
                  <select 
                    value={overrideKey || parsedKey}
                    onChange={(e) => { setOverrideKey(e.target.value); stopSynth(); }}
                    className={ui.field}
                  >
                    {["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Am", "Em", "Bm", "F#m", "C#m", "G#m", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label >
                  SIG: 
                  <select 
                    value={overrideMeter || parsedMeter}
                    onChange={(e) => { setOverrideMeter(e.target.value); stopSynth(); }}
                    className={ui.field}
                  >
                    {["4/4", "3/4", "2/4", "6/8", "9/8", "12/8", "C", "C|"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.tempo}>
                  <span className="opacity-80">BPM:</span>
                  <Button variant="ghost" size="sm" iconOnly type="button"
                    onClick={() => { const t = Math.max(60, tempo - 5); setTempo(t); stopSynth(); }}

                  >
                    −
                  </Button>
                  <strong id="midi-tempo-value" >{tempo}</strong>
                  <Button variant="ghost" size="sm" iconOnly type="button"
                    onClick={() => { const t = Math.min(200, tempo + 5); setTempo(t); stopSynth(); }}

                  >
                    +
                  </Button>
                </div>
              </div>
            )}
            {showLoopControls && loopMode === 'range' && (
              <div className={styles.range}>
                <span className="opacity-50 uppercase tracking-widest">Measure</span>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, totalMeasures)}
                  value={loopStartMeasure}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLoopStartMeasure(val);
                    if (val > loopEndMeasure) setLoopEndMeasure(val);
                  }}
                  className={ui.field}
                />
                <span className="opacity-50">to</span>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, totalMeasures)}
                  value={loopEndMeasure}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLoopEndMeasure(val);
                    if (val < loopStartMeasure) setLoopStartMeasure(val);
                  }}
                  className={ui.field}
                />
              </div>
            )}
          </div>
        </div>
  );
}
