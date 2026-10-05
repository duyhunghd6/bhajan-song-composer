import type { Dispatch, SetStateAction } from "react";
import {
  ABC_LAYER_VOLUME,
  getAbcLayerVolumePercent,
  isAbcLayerVisible,
  type AbcLayerVisibilityItem,
} from "@/lib/theory/abc-layer-visibility";

interface LayerVisibilityControlsProps {
  items: AbcLayerVisibilityItem[];
  visibility: Record<string, boolean>;
  onVisibilityChange: Dispatch<SetStateAction<Record<string, boolean>>>;
  volumes?: Record<string, number>;
  onVolumeChange?: Dispatch<SetStateAction<Record<string, number>>>;
  accentClassName?: string;
  iconVisibility?: boolean;
}

export function LayerVisibilityControls({
  items,
  visibility,
  onVisibilityChange,
  volumes = {},
  onVolumeChange,
  accentClassName = "text-amber-500 focus:ring-amber-500",
  iconVisibility = false,
}: LayerVisibilityControlsProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
      {items.map((item) => {
        const checked = isAbcLayerVisible(item.id, visibility, item.defaultVisible);
        const volumePercent = getAbcLayerVolumePercent(item.id, volumes);
        const canAdjustVolume = item.enabled && checked && item.supportsVolume && onVolumeChange;

        return (
          <div
            key={item.id}
            className={`min-w-0 rounded-xl border bg-white/70 p-2 dark:bg-zinc-950/50 ${item.enabled ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-200 opacity-60 dark:border-zinc-800"}`}
          >
            <div className={`flex items-center gap-2 text-xs font-semibold font-sans ${item.enabled ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400 dark:text-zinc-600"}`}>
              {iconVisibility ? (
                <button
                  type="button"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  aria-label={`${checked ? "Hide" : "Show"} ${item.label}`}
                  aria-pressed={checked}
                  disabled={!item.enabled}
                  onClick={() => onVisibilityChange((prev) => ({ ...prev, [item.id]: !checked }))}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {checked ? <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></> : <><path d="m3 3 18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.4 0 2.6-.3 3.7-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>}
                  </svg>
                </button>
              ) : (
                <input
                  type="checkbox"
                  className={`rounded border-zinc-300 ${accentClassName}`}
                  checked={checked}
                  disabled={!item.enabled}
                  onChange={() => onVisibilityChange((prev) => ({ ...prev, [item.id]: !checked }))}
                />
              )}
              <span>{item.label}</span>
            </div>

            {item.supportsVolume && (
              <label className="mt-2 block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <span className="block tabular-nums">{volumePercent}%</span>
                <input
                  type="range"
                  min={ABC_LAYER_VOLUME.min}
                  max={ABC_LAYER_VOLUME.max}
                  step={ABC_LAYER_VOLUME.step}
                  value={volumePercent}
                  disabled={!canAdjustVolume}
                  className="mt-1 h-1.5 w-full min-w-0 accent-amber-500 disabled:opacity-40"
                  aria-label={`${item.label} volume`}
                  onChange={(event) => {
                    const nextVolume = Number.parseInt(event.target.value, 10);
                    onVolumeChange?.((prev) => ({
                      ...prev,
                      [item.id]: nextVolume,
                    }));
                  }}
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
