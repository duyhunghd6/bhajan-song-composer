"use client";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/Button";

export const PLAYBACK_SPEEDS = [0.1, 0.5, 1, 1.25, 1.5, 2, 3] as const;
export const PlaybackSpeedContext = createContext({ rate: 1, setRate: (() => {}) as (rate: number) => void });
export function PlaybackSpeedMenu({ close }: { close: () => void }) {
  const { rate, setRate } = useContext(PlaybackSpeedContext);
  return <div role="group" aria-label="Playback speed">
    <p className="px-2 py-1 text-xs">Playback speed</p>
    <div className="grid grid-cols-4 gap-1">
      {PLAYBACK_SPEEDS.map(value => <Button key={value} size="sm" role="menuitemradio" aria-checked={rate === value}
        onClick={() => { setRate(value); close(); }}>{value}x</Button>)}
    </div>
  </div>;
}
