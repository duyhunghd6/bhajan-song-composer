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
}

export function LayerVisibilityControls({
  items,
  visibility,
  onVisibilityChange,
  volumes = {},
  onVolumeChange,
  accentClassName = "text-amber-500 focus:ring-amber-500",
}: LayerVisibilityControlsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const checked = isAbcLayerVisible(item.id, visibility, item.defaultVisible);
        const volumePercent = getAbcLayerVolumePercent(item.id, volumes);
        const canAdjustVolume = item.enabled && checked && item.supportsVolume && onVolumeChange;

        return (
          <div
            key={item.id}
            className={`rounded-xl border bg-white/70 p-3 dark:bg-zinc-950/50 ${item.enabled ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-200 opacity-60 dark:border-zinc-800"}`}
          >
            <label
              className={`flex items-center gap-2 text-xs font-semibold font-sans ${item.enabled ? "cursor-pointer text-zinc-800 dark:text-zinc-200" : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"}`}
            >
              <input
                type="checkbox"
                className={`rounded border-zinc-300 ${accentClassName}`}
                checked={checked}
                disabled={!item.enabled}
                onChange={() => onVisibilityChange((prev) => ({
                  ...prev,
                  [item.id]: !checked,
                }))}
              />
              <span>{item.label}</span>
            </label>

            {item.supportsVolume && (
              <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <span className="w-10 tabular-nums">{volumePercent}%</span>
                <input
                  type="range"
                  min={ABC_LAYER_VOLUME.min}
                  max={ABC_LAYER_VOLUME.max}
                  step={ABC_LAYER_VOLUME.step}
                  value={volumePercent}
                  disabled={!canAdjustVolume}
                  className="h-1.5 flex-1 accent-amber-500 disabled:opacity-40"
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
