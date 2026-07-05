import type { Dispatch, SetStateAction } from "react";
import type { MusicSheetLoopMode } from "../playback";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface AbcjsPlaybackControlsProps {
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
        <div className="flex flex-wrap gap-y-3 items-center justify-between bg-[#1e1e1e] text-zinc-300 px-4 py-2.5 text-sm border-b border-black shadow-inner">
          {/* Left: Transport & Time */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <button
                id="midi-btn-stop"
                onClick={stopSynth}
                className="hover:text-white transition-colors cursor-pointer"
                title="Rewind to start"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>
              {!isPlaying ? (
                <button
                  id="midi-btn-play"
                  onClick={playSynth}
                  className="hover:text-white transition-colors cursor-pointer"
                  title="Play"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                </button>
              ) : (
                <button
                  id="midi-btn-pause"
                  onClick={pauseSynth}
                  className="hover:text-white transition-colors cursor-pointer"
                  title="Pause"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                </button>
              )}
              {showLoopControls && (
                <button
                  onClick={() => setLoopMode(loopMode === 'range' ? 'whole' : 'range')}
                  className={`transition-colors cursor-pointer ${loopMode === 'range' ? 'text-amber-500' : 'hover:text-white'}`}
                  title="Toggle Loop Range"
                >
                  <span className="sr-only">{loopMode === "range" ? "Measure range" : "Whole sheet"}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
            </div>

            <span className="font-mono text-[11px] opacity-70 tracking-widest">
              {formatTime(currentSeconds)} / {formatTime(durationSeconds)}
            </span>
          </div>

          {/* Center: Empty to maintain space */}
          <div className="hidden md:block flex-1" />

          {/* Right: Metadata dropdowns, BPM, & Loop range sliders */}
          <div className="flex items-center gap-4 justify-end">
            {controls && (
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono bg-black/20 px-2.5 py-1 rounded border border-white/5" title="Sheet Metadata Overrides">
                <label className="flex items-center gap-1.5 opacity-80">
                  KEY: 
                  <select 
                    value={overrideKey || parsedKey}
                    onChange={(e) => { setOverrideKey(e.target.value); stopSynth(); }}
                    className="bg-[#121212] text-amber-500 font-semibold border border-zinc-800 rounded px-1 py-0.5 outline-none cursor-pointer"
                  >
                    {["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Am", "Em", "Bm", "F#m", "C#m", "G#m", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 opacity-80">
                  SIG: 
                  <select 
                    value={overrideMeter || parsedMeter}
                    onChange={(e) => { setOverrideMeter(e.target.value); stopSynth(); }}
                    className="bg-[#121212] text-amber-500 font-semibold border border-zinc-800 rounded px-1 py-0.5 outline-none cursor-pointer"
                  >
                    {["4/4", "3/4", "2/4", "6/8", "9/8", "12/8", "C", "C|"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3 ml-1">
                  <span className="opacity-80">BPM:</span>
                  <button
                    onClick={() => { const t = Math.max(60, tempo - 5); setTempo(t); stopSynth(); }}
                    className="px-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                  >
                    −
                  </button>
                  <strong id="midi-tempo-value" className="text-amber-500 font-semibold min-w-[20px] text-center">{tempo}</strong>
                  <button
                    onClick={() => { const t = Math.min(200, tempo + 5); setTempo(t); stopSynth(); }}
                    className="px-1 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            {showLoopControls && loopMode === 'range' && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
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
                  className="w-10 bg-[#121212] text-center border border-zinc-800 rounded py-0.5 outline-none focus:border-amber-500 transition-colors"
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
                  className="w-10 bg-[#121212] text-center border border-zinc-800 rounded py-0.5 outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            )}
          </div>
        </div>
  );
}
