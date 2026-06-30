const DEFAULT_TUNING = ["E", "A", "D", "G", "B", "E"];
const DEFAULT_STRING_COUNT = 6;
const DEFAULT_FRET_COUNT = 4;

const FRETBOARD_LEFT = 58;
const FRETBOARD_TOP = 54;
const STRING_SPACING = 34;
const FRET_SPACING = 42;
const MARKER_RADIUS = 13;

type GuitarPositionTone = "root" | "chord" | "melody" | "bass";

export interface GuitarFretPosition {
  /** Guitar string number, where 1 is high E and 6 is low E. */
  string: number;
  /** Fret number. Use 0 for open strings. */
  fret: number;
  finger?: number | string;
  note?: string;
  tone?: GuitarPositionTone;
}

export interface GuitarFretboardProps {
  title?: string;
  subtitle?: string;
  tuning?: string[];
  positions?: GuitarFretPosition[];
  openStrings?: number[];
  mutedStrings?: number[];
  startFret?: number;
  fretCount?: number;
  capoFret?: number;
  className?: string;
}

const POSITION_TONE_CLASSES: Record<GuitarPositionTone, string> = {
  root: "fill-amber-500 stroke-amber-700 dark:stroke-amber-300",
  chord: "fill-rose-500 stroke-rose-700 dark:stroke-rose-300",
  melody: "fill-sky-500 stroke-sky-700 dark:stroke-sky-300",
  bass: "fill-emerald-500 stroke-emerald-700 dark:stroke-emerald-300",
};

function clampPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function getGuitarStringX(string: number, stringCount = DEFAULT_STRING_COUNT): number {
  return FRETBOARD_LEFT + (stringCount - string) * STRING_SPACING;
}

export function getGuitarFretY(fret: number, startFret = 1): number {
  return FRETBOARD_TOP + (fret - startFret + 0.5) * FRET_SPACING;
}

export function describeGuitarPosition(position: GuitarFretPosition): string {
  const note = position.note ? `${position.note} ` : "";
  const finger = position.finger ? ` with finger ${position.finger}` : "";

  if (position.fret === 0) {
    return `${note}open string ${position.string}${finger}`.trim();
  }

  return `${note}string ${position.string}, fret ${position.fret}${finger}`.trim();
}

export function getVisibleGuitarPositions(
  positions: GuitarFretPosition[],
  startFret = 1,
  fretCount = DEFAULT_FRET_COUNT
): GuitarFretPosition[] {
  const firstFret = clampPositiveInteger(startFret, 1);
  const visibleFrets = clampPositiveInteger(fretCount, DEFAULT_FRET_COUNT);
  const lastFret = firstFret + visibleFrets - 1;

  return positions.filter((position) => position.fret >= firstFret && position.fret <= lastFret);
}

function buildStringStatuses(
  positions: GuitarFretPosition[],
  openStrings: number[],
  mutedStrings: number[]
): Map<number, "open" | "muted"> {
  const statuses = new Map<number, "open" | "muted">();

  for (const string of openStrings) {
    statuses.set(string, "open");
  }

  for (const position of positions) {
    if (position.fret === 0) {
      statuses.set(position.string, "open");
    }
  }

  for (const string of mutedStrings) {
    statuses.set(string, "muted");
  }

  return statuses;
}

export default function GuitarFretboard({
  title = "Guitar voicing",
  subtitle,
  tuning = DEFAULT_TUNING,
  positions = [],
  openStrings = [],
  mutedStrings = [],
  startFret = 1,
  fretCount = DEFAULT_FRET_COUNT,
  capoFret,
  className = "",
}: GuitarFretboardProps) {
  const stringCount = tuning.length || DEFAULT_STRING_COUNT;
  const firstFret = clampPositiveInteger(startFret, 1);
  const visibleFrets = clampPositiveInteger(fretCount, DEFAULT_FRET_COUNT);
  const width = FRETBOARD_LEFT * 2 + (stringCount - 1) * STRING_SPACING;
  const fretboardBottom = FRETBOARD_TOP + visibleFrets * FRET_SPACING;
  const height = fretboardBottom + 48;
  const visiblePositions = getVisibleGuitarPositions(positions, firstFret, visibleFrets);
  const stringStatuses = buildStringStatuses(positions, openStrings, mutedStrings);
  const capoIsVisible =
    typeof capoFret === "number" && capoFret >= firstFret && capoFret < firstFret + visibleFrets;

  return (
    <section
      className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <div className="mb-4 space-y-1">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
        {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`${title} guitar fretboard diagram`}
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[320px] text-zinc-900 dark:text-zinc-100"
        >
          <rect
            x={FRETBOARD_LEFT - 20}
            y={FRETBOARD_TOP - 8}
            width={(stringCount - 1) * STRING_SPACING + 40}
            height={visibleFrets * FRET_SPACING + 16}
            rx="14"
            className="fill-amber-50 stroke-amber-100 dark:fill-zinc-950 dark:stroke-zinc-800"
          />

          {Array.from({ length: visibleFrets + 1 }, (_, index) => {
            const y = FRETBOARD_TOP + index * FRET_SPACING;
            const isNut = index === 0 && firstFret === 1;

            return (
              <line
                key={`fret-${index}`}
                x1={FRETBOARD_LEFT}
                y1={y}
                x2={getGuitarStringX(1, stringCount)}
                y2={y}
                strokeLinecap="round"
                className="stroke-zinc-400 dark:stroke-zinc-600"
                strokeWidth={isNut ? 6 : 2}
              />
            );
          })}

          {tuning.map((note, index) => {
            const stringNumber = stringCount - index;
            const x = getGuitarStringX(stringNumber, stringCount);
            const status = stringStatuses.get(stringNumber);

            return (
              <g key={`string-${stringNumber}`}>
                <line
                  x1={x}
                  y1={FRETBOARD_TOP}
                  x2={x}
                  y2={fretboardBottom}
                  strokeLinecap="round"
                  className="stroke-zinc-500 dark:stroke-zinc-500"
                  strokeWidth={1.4 + index * 0.2}
                />
                <text
                  x={x}
                  y={height - 16}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[11px] font-semibold dark:fill-zinc-400"
                >
                  {note}
                </text>
                {status && (
                  <text
                    x={x}
                    y={FRETBOARD_TOP - 20}
                    textAnchor="middle"
                    className="fill-zinc-700 text-sm font-bold dark:fill-zinc-200"
                  >
                    {status === "muted" ? "×" : "○"}
                  </text>
                )}
              </g>
            );
          })}

          {Array.from({ length: visibleFrets }, (_, index) => {
            const fret = firstFret + index;
            const y = FRETBOARD_TOP + index * FRET_SPACING + FRET_SPACING / 2 + 4;

            return (
              <text
                key={`fret-label-${fret}`}
                x={FRETBOARD_LEFT - 34}
                y={y}
                textAnchor="middle"
                className="fill-zinc-400 text-[11px] font-semibold dark:fill-zinc-500"
              >
                {fret}
              </text>
            );
          })}

          {capoIsVisible && (
            <g aria-label={`Capo on fret ${capoFret}`}>
              <rect
                x={FRETBOARD_LEFT - 12}
                y={getGuitarFretY(capoFret, firstFret) - 8}
                width={(stringCount - 1) * STRING_SPACING + 24}
                height="16"
                rx="8"
                className="fill-zinc-800/80 dark:fill-zinc-200/80"
              />
              <text
                x={FRETBOARD_LEFT + ((stringCount - 1) * STRING_SPACING) / 2}
                y={getGuitarFretY(capoFret, firstFret) + 4}
                textAnchor="middle"
                className="fill-white text-[10px] font-bold dark:fill-zinc-950"
              >
                capo {capoFret}
              </text>
            </g>
          )}

          {visiblePositions.map((position) => {
            const tone = position.tone ?? "chord";
            const x = getGuitarStringX(position.string, stringCount);
            const y = getGuitarFretY(position.fret, firstFret);
            const label = position.finger ?? position.note ?? "•";

            return (
              <g key={`${position.string}-${position.fret}-${position.finger ?? position.note ?? "note"}`}>
                <title>{describeGuitarPosition(position)}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={MARKER_RADIUS}
                  strokeWidth="2"
                  className={POSITION_TONE_CLASSES[tone]}
                />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-white text-[11px] font-bold"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
