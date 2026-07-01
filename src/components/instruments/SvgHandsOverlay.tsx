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
  measureIndex?: number;
  beat?: number;
}

export interface SvgHandTransitionPathEvent {
  id: string;
  instrument: SvgHandInstrument;
  hand: SvgHandSide;
  finger: number | string;
  from: SvgHandTarget;
  to: SvgHandTarget;
  cursorSeconds: number;
  fromMeasureIndex?: number;
  toMeasureIndex?: number;
}

export interface SvgHandsOverlayProps {
  title?: string;
  events?: SvgHandFingeringEvent[];
  transitionPathEvents?: SvgHandTransitionPathEvent[];
  width?: number;
  height?: number;
  className?: string;
}

function describeFingeringEvent(event: SvgHandFingeringEvent): string {
  const target = event.target.label ? ` on ${event.target.label}` : "";
  return `${event.hand} hand finger ${event.finger}${target} at ${event.cursorSeconds.toFixed(1)}s`;
}

function measureLabel(measureIndex: number | undefined): string | null {
  return typeof measureIndex === "number" ? `measure ${measureIndex + 1}` : null;
}

function targetLabel(target: SvgHandTarget): string {
  return target.label ?? `(${target.x}, ${target.y})`;
}

function describeTransitionPathEvent(event: SvgHandTransitionPathEvent): string {
  const fromMeasure = measureLabel(event.fromMeasureIndex);
  const toMeasure = measureLabel(event.toMeasureIndex);
  const from = `${targetLabel(event.from)}${fromMeasure ? ` in ${fromMeasure}` : ""}`;
  const to = `${targetLabel(event.to)}${toMeasure ? ` in ${toMeasure}` : ""}`;

  return `${event.hand} hand finger ${event.finger} moves from ${from} to ${to}`;
}

function transitionKey(event: SvgHandFingeringEvent): string {
  return `${event.instrument}-${event.hand}-${event.finger}`;
}

function hasMoved(from: SvgHandTarget, to: SvgHandTarget): boolean {
  return from.x !== to.x || from.y !== to.y;
}

function transitionPathD(event: SvgHandTransitionPathEvent): string {
  const midX = (event.from.x + event.to.x) / 2;
  return `M ${event.from.x} ${event.from.y} C ${midX} ${event.from.y}, ${midX} ${event.to.y}, ${event.to.x} ${event.to.y}`;
}

export function buildSvgHandTransitionPathEvents(events: SvgHandFingeringEvent[]): SvgHandTransitionPathEvent[] {
  const grouped = new Map<string, SvgHandFingeringEvent[]>();

  for (const event of events) {
    const key = transitionKey(event);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  return Array.from(grouped.values()).flatMap((fingerEvents) => {
    const sortedEvents = [...fingerEvents].sort(
      (left, right) => left.cursorSeconds - right.cursorSeconds || left.id.localeCompare(right.id)
    );
    const transitions: SvgHandTransitionPathEvent[] = [];

    for (let index = 1; index < sortedEvents.length; index++) {
      const fromEvent = sortedEvents[index - 1];
      const toEvent = sortedEvents[index];

      if (!hasMoved(fromEvent.target, toEvent.target)) continue;

      transitions.push({
        id: `${toEvent.instrument}-${toEvent.hand}-${toEvent.finger}-transition-${fromEvent.id}-to-${toEvent.id}`,
        instrument: toEvent.instrument,
        hand: toEvent.hand,
        finger: toEvent.finger,
        from: fromEvent.target,
        to: toEvent.target,
        cursorSeconds: toEvent.cursorSeconds,
        fromMeasureIndex: fromEvent.measureIndex,
        toMeasureIndex: toEvent.measureIndex,
      });
    }

    return transitions;
  });
}

export default function SvgHandsOverlay({
  title = "Animated hands",
  events = [],
  transitionPathEvents = [],
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
      <g aria-label={`${title} transition paths`} opacity="0.7">
        {transitionPathEvents.map((event) => (
          <path
            key={event.id}
            d={transitionPathD(event)}
            className={event.hand === "left" ? "fill-none stroke-sky-500" : "fill-none stroke-amber-500"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 5"
            style={{ animation: "guitar-transition-path 900ms ease-out" }}
          >
            <title>{describeTransitionPathEvent(event)}</title>
          </path>
        ))}
      </g>

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
