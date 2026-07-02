export type InstrumentMarkerHand = "left" | "right";

export interface InstrumentNoteMarker {
  id: string;
  hand: InstrumentMarkerHand;
  fingerNumber: 1 | 2 | 3 | 4 | 5;
  x: number;
  y: number;
  noteLabel?: string;
  techniqueLabel?: string;
  measureIndex?: number;
  beat?: number;
}

export interface InstrumentNoteMarkersProps {
  title?: string;
  markers?: InstrumentNoteMarker[];
  width: number;
  height: number;
  className?: string;
}

function markerText(fingerNumber: InstrumentNoteMarker["fingerNumber"]): string {
  return `(${fingerNumber})`;
}

function markerClasses(hand: InstrumentMarkerHand): string {
  return hand === "left"
    ? "fill-sky-500 stroke-sky-800 dark:fill-sky-400 dark:stroke-sky-100"
    : "fill-amber-400 stroke-amber-700 dark:fill-amber-300 dark:stroke-amber-100";
}

function markerTextClasses(hand: InstrumentMarkerHand): string {
  return hand === "left" ? "fill-white text-[10px] font-black" : "fill-zinc-950 text-[10px] font-black";
}

function describeMarker(marker: InstrumentNoteMarker): string {
  const note = marker.noteLabel ? ` on ${marker.noteLabel}` : "";
  const technique = marker.techniqueLabel ? ` for ${marker.techniqueLabel}` : "";
  const measure = typeof marker.measureIndex === "number" ? ` at measure ${marker.measureIndex + 1}` : "";
  const beat = typeof marker.beat === "number" ? ` beat ${marker.beat}` : "";

  return `${marker.hand} hand marker ${markerText(marker.fingerNumber)}${note}${technique}${measure}${beat}`;
}

export default function InstrumentNoteMarkers({
  title = "Instrument note markers",
  markers = [],
  width,
  height,
  className = "",
}: InstrumentNoteMarkersProps) {
  return (
    <svg
      role="img"
      aria-label={`${title} numbered note markers`}
      viewBox={`0 0 ${width} ${height}`}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="none"
    >
      <g aria-label={`${title} marker targets`}>
        {markers.map((marker) => (
          <g key={marker.id} transform={`translate(${marker.x} ${marker.y})`}>
            <title>{describeMarker(marker)}</title>
            <circle r="14" className={markerClasses(marker.hand)} strokeWidth="2" />
            <text x="0" y="4" textAnchor="middle" className={markerTextClasses(marker.hand)}>
              {markerText(marker.fingerNumber)}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
