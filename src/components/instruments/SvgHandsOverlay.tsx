type SvgHandInstrument = "guitar" | "piano";
type SvgHandSide = "left" | "right";

export interface SvgHandTarget {
  x: number;
  y: number;
  label?: string;
}

export interface SvgHandFingeringEvent {
  id: string;
  instrument: SvgHandInstrument;
  hand: SvgHandSide;
  finger: number | string;
  target: SvgHandTarget;
  cursorSeconds: number;
}

export interface SvgHandsOverlayProps {
  title?: string;
  events?: SvgHandFingeringEvent[];
  width?: number;
  height?: number;
  className?: string;
}

function describeFingeringEvent(event: SvgHandFingeringEvent): string {
  const target = event.target.label ? ` on ${event.target.label}` : "";
  return `${event.hand} hand finger ${event.finger}${target} at ${event.cursorSeconds.toFixed(1)}s`;
}

export default function SvgHandsOverlay({
  title = "Animated hands",
  events = [],
  width = 320,
  height = 220,
  className = "",
}: SvgHandsOverlayProps) {
  return (
    <svg
      role="img"
      aria-label={`${title} SVG hands overlay`}
      viewBox={`0 0 ${width} ${height}`}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="none"
    >
      <g opacity="0.5">
        {events.map((event) => {
          const isLeftHand = event.hand === "left";
          const fillClass = isLeftHand
            ? "fill-sky-500 stroke-sky-800 dark:stroke-sky-200"
            : "fill-amber-500 stroke-amber-800 dark:stroke-amber-200";
          const wristOffset = isLeftHand ? -24 : 24;

          return (
            <g
              key={event.id}
              transform={`translate(${event.target.x} ${event.target.y})`}
              style={{ transition: "transform 180ms ease-out" }}
            >
              <title>{describeFingeringEvent(event)}</title>
              <path
                d={`M ${wristOffset} 32 C ${wristOffset * 0.7} 12, ${wristOffset * 0.5} 2, 0 0`}
                className="fill-none stroke-zinc-700 dark:stroke-zinc-200"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <ellipse
                cx={wristOffset}
                cy="38"
                rx="18"
                ry="12"
                className="fill-zinc-300 stroke-zinc-700 dark:fill-zinc-200 dark:stroke-zinc-100"
                strokeWidth="2"
              />
              <circle cx="0" cy="0" r="14" className={fillClass} strokeWidth="2" />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                className="fill-white text-[11px] font-bold"
              >
                {event.finger}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
