import React from "react";
import { Note } from "@tonaljs/tonal";
import { type GuitarVoicing } from "@/lib/theory/guitar-voicings";

const CHROMATIC_SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const STRING_TUNING = [
  { string: 1, note: "E", octave: 4 },
  { string: 2, note: "B", octave: 3 },
  { string: 3, note: "G", octave: 3 },
  { string: 4, note: "D", octave: 3 },
  { string: 5, note: "A", octave: 2 },
  { string: 6, note: "E", octave: 2 },
];

// Tailwind colors converted to hex for SVG
const PITCH_COLORS: Record<string, { fill: string; text: string }> = {
  "C": { fill: "#f43f5e", text: "#fff" }, // rose-500
  "C#": { fill: "#f97316", text: "#fff" }, // orange-500
  "D": { fill: "#f59e0b", text: "#fff" }, // amber-500
  "D#": { fill: "#eab308", text: "#fff" }, // yellow-500
  "E": { fill: "#84cc16", text: "#fff" }, // lime-500
  "F": { fill: "#22c55e", text: "#fff" }, // green-500
  "F#": { fill: "#10b981", text: "#fff" }, // emerald-500
  "G": { fill: "#14b8a6", text: "#fff" }, // teal-500
  "G#": { fill: "#06b6d4", text: "#fff" }, // cyan-500
  "A": { fill: "#0ea5e9", text: "#fff" }, // sky-500
  "A#": { fill: "#3b82f6", text: "#fff" }, // blue-500
  "B": { fill: "#8b5cf6", text: "#fff" }, // violet-500
};

export interface VirtualGuitarFretboardProps {
  fretCount?: number;
  className?: string;
  activeNotes?: string[];
  activeVoicings?: GuitarVoicing[];
  onNoteClick?: (note: string, stringNumber: number, fret: number) => void;
}

export default function VirtualGuitarFretboard({
  fretCount = 16,
  className = "",
  activeNotes,
  onNoteClick,
  activeVoicings,
}: VirtualGuitarFretboardProps) {
  // Normalize active notes to their chromatic index (0-11)
  const activeChromaticIndices = React.useMemo(() => {
    if (!activeNotes || activeNotes.length === 0) return null;
    return new Set(
      activeNotes
        .map((n) => Note.chroma(n))
        .filter((n): n is number => n !== undefined && n !== null)
    );
  }, [activeNotes]);

  // Guitar Math
  const scaleLength = 2000;
  const nutX = 120;
  const boardYTop = 30;
  const boardYBottom = 210;
  
  // Calculate exact fret positions using logarithmic rule of 18 (2^(1/12))
  const fretsX = Array.from({ length: fretCount + 1 }, (_, n) => {
    return nutX + scaleLength * (1 - Math.pow(2, -n / 12));
  });

  const stringYs = STRING_TUNING.map((_, i) => 40 + i * 32);

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-inherit">Realistic Virtual Guitar Fretboard</h2>
          <p className="mt-1 text-sm opacity-70">
            Logarithmic fret spacing, authentic pearl inlay dots, varying string gauges, and chromatic coloring.
          </p>
        </div>
      </div>

      <div className="relative min-w-[1200px]">
        <svg 
          viewBox={`0 0 ${fretsX[fretCount] + 40} 250`} 
          className="w-full h-auto drop-shadow-sm font-sans"
        >
          {/* Fretboard Wood Background */}
          <rect 
            x={nutX} 
            y={boardYTop} 
            width={fretsX[fretCount] - nutX + 20} 
            height={boardYBottom - boardYTop} 
            fill="#3d2616" // Dark rosewood color
            rx="4"
          />

          {/* Fret Wires */}
          {fretsX.map((x, n) => {
            if (n === 0) {
              // Nut
              return (
                <g key={`fret-${n}`}>
                  <rect x={x - 6} y={boardYTop - 2} width="6" height={boardYBottom - boardYTop + 4} fill="#e5e5e5" rx="1" />
                  <rect x={x - 4} y={boardYTop} width="2" height={boardYBottom - boardYTop} fill="#f5f5f5" />
                </g>
              );
            }
            // Normal frets
            return (
              <g key={`fret-${n}`}>
                <line x1={x} y1={boardYTop} x2={x} y2={boardYBottom} stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
                <line x1={x - 0.5} y1={boardYTop} x2={x - 0.5} y2={boardYBottom} stroke="#e5e7eb" strokeWidth="1" />
              </g>
            );
          })}

          {/* Pearl Inlay Dots */}
          {[3, 5, 7, 9, 12, 15].map((fret) => {
            if (fret > fretCount) return null;
            const midX = (fretsX[fret - 1] + fretsX[fret]) / 2;
            
            if (fret === 12) {
              // Two dots for 12th fret, positioned between strings 2-3 and 4-5
              const topDotY = (stringYs[1] + stringYs[2]) / 2;
              const bottomDotY = (stringYs[3] + stringYs[4]) / 2;
              return (
                <g key={`inlay-${fret}`}>
                  <circle cx={midX} cy={topDotY} r="5" fill="#f8fafc" opacity="0.8" />
                  <circle cx={midX} cy={bottomDotY} r="5" fill="#f8fafc" opacity="0.8" />
                </g>
              );
            } else {
              // Single dot in the center
              const midY = (boardYTop + boardYBottom) / 2;
              return (
                <circle key={`inlay-${fret}`} cx={midX} cy={midY} r="6" fill="#f8fafc" opacity="0.8" />
              );
            }
          })}

          {/* Strings */}
          {STRING_TUNING.map((tuning, i) => {
            const y = stringYs[i];
            const thickness = 1 + i * 0.6; // String 1 is 1px, String 6 is 4px

            return (
              <g key={`string-line-${tuning.string}`}>
                {/* String shadow */}
                <line x1={40} y1={y + 1} x2={fretsX[fretCount] + 30} y2={y + 1} stroke="rgba(0,0,0,0.4)" strokeWidth={thickness} />
                {/* Main string */}
                <line x1={40} y1={y} x2={fretsX[fretCount] + 30} y2={y} stroke={i < 2 ? "#e5e7eb" : "#d1d5db"} strokeWidth={thickness} strokeLinecap="round" />
                
                {/* Left side labels */}
                <circle cx={90} cy={y} r="12" fill="#27272a" />
                <text x={90} y={y + 4} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">{tuning.note}</text>
                
                <text x={30} y={y + 4} fill="#71717a" fontSize="12" fontWeight="bold" textAnchor="middle">{tuning.string}</text>
              </g>
            );
          })}

          <text x={30} y={20} fill="#a1a1aa" fontSize="10" fontWeight="bold" textAnchor="middle">STR</text>

          {/* Constellation Grouping Lines */}
          {activeVoicings?.map((voicing, vIdx) => {
            const points: [number, number][] = [];
            voicing.frets.forEach((fret, i) => {
              if (typeof fret === "number") {
                const stringNum = 6 - i;
                const stringIdx = STRING_TUNING.findIndex(s => s.string === stringNum);
                const y = stringYs[stringIdx];
                const x = fret === 0 
                  ? nutX - 22 
                  : fret === 1 
                    ? (nutX + fretsX[0]) / 2 
                    : (fretsX[fret - 2] + fretsX[fret - 1]) / 2;
                points.push([x, y]);
              }
            });
            if (points.length < 2) return null;
            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(" ");
            return (
              <path 
                key={`constellation-${vIdx}`} 
                d={pathData} 
                fill="none" 
                stroke="#fbbf24" 
                strokeWidth="2" 
                strokeDasharray="6 4" 
                opacity={voicing.isPrimary ? 0.8 : 0.3} 
              />
            );
          })}

          {/* Barre Lines */}
          {activeVoicings?.map((voicing, vIdx) => {
            if (!voicing.barre) return null;
            const fromIdx = STRING_TUNING.findIndex(s => s.string === voicing.barre!.fromString);
            const toIdx = STRING_TUNING.findIndex(s => s.string === voicing.barre!.toString);
            const y1 = stringYs[Math.min(fromIdx, toIdx)];
            const y2 = stringYs[Math.max(fromIdx, toIdx)];
            const fret = voicing.barre.fret;
            const x = fret === 1 ? (nutX + fretsX[0]) / 2 : (fretsX[fret - 2] + fretsX[fret - 1]) / 2;
            return (
              <rect 
                key={`barre-${vIdx}`}
                x={x - 8}
                y={y1 - 6}
                width={16}
                height={y2 - y1 + 12}
                rx={8}
                fill="#fbbf24"
                opacity={voicing.isPrimary ? 0.6 : 0.2}
              />
            );
          })}

          {/* Notes and Mutes */}
          {STRING_TUNING.map((tuning, i) => {
            const y = stringYs[i];
            const baseIndex = CHROMATIC_SCALE.indexOf(tuning.note);
            const fretIdx = 6 - tuning.string;

            // Find if this string is muted in any active voicing (and it's the primary, or we just show X if it's explicitly muted)
            const isMuted = activeVoicings?.some(v => v.isPrimary && v.frets[fretIdx] === "X");

            return (
              <g key={`notes-${tuning.string}`}>
                {isMuted && (
                  <text x={nutX - 35} y={y + 5} fill="#ef4444" fontSize="16" fontWeight="bold" textAnchor="middle">X</text>
                )}
                {Array.from({ length: fretCount + 1 }).map((_, fret) => {
                  let isActive = false;
                  let isPrimary = false;
                  let finger: number | "X" | undefined;
                  let opacity = 0.15;
                  
                  if (activeVoicings && activeVoicings.length > 0) {
                    // Specific voicing mode
                    for (const v of activeVoicings) {
                      if (v.frets[fretIdx] === fret) {
                        isActive = true;
                        if (v.isPrimary) isPrimary = true;
                        if (v.fingers && typeof v.fingers[fretIdx] === "number" && v.fingers[fretIdx] !== 0) {
                          finger = v.fingers[fretIdx];
                        }
                      }
                    }
                    opacity = isActive ? (isPrimary ? 1 : 0.4) : 0.05;
                  } else {
                    // Fallback to pitch class highlighting
                    const noteIndex = (baseIndex + fret) % 12;
                    isActive = activeChromaticIndices ? activeChromaticIndices.has(noteIndex) : true;
                    opacity = isActive ? 1 : 0.15;
                  }
                  
                  if (!isActive && activeVoicings && activeVoicings.length > 0) {
                    return null; // hide non-played notes in voicing mode
                  }

                  const x = fret === 0 
                    ? nutX - 22 
                    : fret === 1 
                      ? (nutX + fretsX[0]) / 2 
                      : (fretsX[fret - 2] + fretsX[fret - 1]) / 2;
                  const noteIndex = (baseIndex + fret) % 12;
                  const noteName = CHROMATIC_SCALE[noteIndex];
                  const color = PITCH_COLORS[noteName];
                  const radius = fret === 0 ? 10 : 12;
                  const pointerEvents = isActive ? "auto" : "none";

                  return (
                    <g 
                      key={`note-${tuning.string}-${fret}`} 
                      className="transition-transform hover:scale-125" 
                      style={{ 
                        transformOrigin: `${x}px ${y}px`, 
                        opacity,
                        cursor: isActive ? (onNoteClick ? "pointer" : "crosshair") : "default",
                        pointerEvents
                      }}
                      onClick={() => {
                        if (isActive && onNoteClick) {
                          onNoteClick(noteName, tuning.string, fret);
                        }
                      }}
                    >
                      <title>{`String ${tuning.string} / Fret ${fret} - ${noteName}`}</title>
                      <circle cx={x} cy={y} r={radius} fill={color.fill} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                      {finger ? (
                        <text x={x} y={y + 4.5} fill={color.text} fontSize="13" fontWeight="900" textAnchor="middle">
                          {finger}
                        </text>
                      ) : (
                        <text x={x} y={y + 3.5} fill={color.text} fontSize="10" fontWeight="bold" textAnchor="middle">
                          {noteName}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Fret Numbers Label Bottom */}
          {fretsX.map((x, fret) => {
            if (fret === 0 || fret > fretCount) return null;
            const midX = (fretsX[fret - 1] + fretsX[fret]) / 2;
            
            return (
              <text key={`fret-label-${fret}`} x={midX} y={235} fill="#71717a" fontSize="13" fontWeight="bold" textAnchor="middle">
                {fret}
              </text>
            );
          })}
          
          <text x={nutX - 22} y={235} fill="#71717a" fontSize="11" fontWeight="bold" textAnchor="middle">Nut</text>
        </svg>
      </div>
    </div>
  );
}
