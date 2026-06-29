"use client";

import { useEffect, useRef, useState } from "react";

interface AbcSheetViewerProps {
  abcString: string;
  songTitle: string;
}

export default function AbcSheetViewer({ abcString, songTitle }: AbcSheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [abcjsModule, setAbcjsModule] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const synthRef = useRef<any>(null);
  const synthControlRef = useRef<any>(null);
  const visualObjRef = useRef<any>(null);

  // Load abcjs on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("abcjs").then((mod) => {
        setAbcjsModule(mod.default);
      });
    }
  }, []);

  // Render ABC notation when module or string changes
  useEffect(() => {
    if (!abcjsModule || !containerRef.current) return;

    try {
      // Clear previous rendering
      containerRef.current.innerHTML = "";

      const visualObj = abcjsModule.renderAbc(containerRef.current, abcString, {
        responsive: "resize",
        add_classes: true,
      });

      visualObjRef.current = visualObj[0];

      // Cleanup synthesizer when tune changes
      stopSynth();
    } catch (err) {
      console.error("Error rendering ABC notation:", err);
    }

    return () => {
      stopSynth();
    };
  }, [abcjsModule, abcString]);

  const initSynth = async () => {
    if (!abcjsModule || !visualObjRef.current) return;

    try {
      if (typeof window !== "undefined" && window.AudioContext || (window as any).webkitAudioContext) {
        // Create audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();

        // Create Synth instance
        const synth = new abcjsModule.synth.CreateSynth();
        synthRef.current = synth;

        await synth.init({
          visualObj: visualObjRef.current,
          audioContext,
          millisecondsPerMeasure: (60000 / tempo) * 4, // 4/4 default assumption, adjustable
        });

        await synth.prime();
        return synth;
      }
    } catch (err) {
      console.error("Error initializing synth:", err);
    }
    return null;
  };

  const playSynth = async () => {
    if (isPlaying) return;

    try {
      let synth = synthRef.current;
      if (!synth) {
        synth = await initSynth();
      }

      if (synth) {
        synth.start();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Error playing synth:", err);
    }
  };

  const pauseSynth = () => {
    if (!isPlaying || !synthRef.current) return;
    try {
      synthRef.current.pause();
      setIsPlaying(false);
    } catch (err) {
      console.error("Error pausing synth:", err);
    }
  };

  const stopSynth = () => {
    if (synthRef.current) {
      try {
        synthRef.current.stop();
      } catch (err) {
        console.error("Error stopping synth:", err);
      }
      synthRef.current = null;
    }
    setIsPlaying(false);
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col space-y-6">
      {/* Controls Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div className="flex items-center space-x-3">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Music Sheet Playback
          </h3>
        </div>

        {/* MIDI Control Buttons */}
        <div className="flex items-center space-x-2">
          {!isPlaying ? (
            <button
              id="midi-btn-play"
              onClick={playSynth}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </button>
          ) : (
            <button
              id="midi-btn-pause"
              onClick={pauseSynth}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              Pause
            </button>
          )}

          <button
            id="midi-btn-stop"
            onClick={stopSynth}
            className="p-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
            Stop
          </button>

          {/* Tempo Selector */}
          <div className="flex items-center space-x-2 ml-4">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Tempo:</span>
            <input
              id="midi-tempo-input"
              type="range"
              min="60"
              max="200"
              value={tempo}
              onChange={(e) => {
                const newTempo = parseInt(e.target.value);
                setTempo(newTempo);
                if (synthRef.current) {
                  stopSynth();
                }
              }}
              className="w-24 accent-amber-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 w-8">
              {tempo}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="overflow-x-auto p-4 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
        {!abcjsModule && (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-400 dark:text-zinc-600">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading Music Notation Renderer...
          </div>
        )}
        <div
          ref={containerRef}
          id="abc-music-canvas"
          className="w-full min-w-[600px] dark:invert dark:hue-rotate-180"
        />
      </div>
    </div>
  );
}
