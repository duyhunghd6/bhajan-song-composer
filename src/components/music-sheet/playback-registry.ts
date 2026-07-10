/**
 * Global playback registry — ensures only one AbcjsPlaybackController
 * instance plays audio at a time across the entire page.
 *
 * Each controller registers a stop callback keyed by its instance ID.
 * When any controller starts playing, it calls `claimPlayback(myId)` which
 * stops the previously active controller (if any) before granting ownership.
 */

type StopCallback = () => void;

const registry = new Map<string, StopCallback>();
let activeId: string | null = null;

/**
 * Register a controller instance so it can be stopped by the registry.
 * Call this on mount; call `unregisterPlayback` on unmount.
 */
export function registerPlayback(id: string, stop: StopCallback): void {
  registry.set(id, stop);
}

/**
 * Remove a controller instance from the registry (on unmount).
 */
export function unregisterPlayback(id: string): void {
  registry.delete(id);
  if (activeId === id) {
    activeId = null;
  }
}

/**
 * Claim exclusive playback. Stops the previously active controller if
 * it is a different instance.
 */
export function claimPlayback(id: string): void {
  if (activeId && activeId !== id) {
    const stopPrev = registry.get(activeId);
    if (stopPrev) {
      try {
        stopPrev();
      } catch {
        /* best-effort */
      }
    }
  }
  activeId = id;
}

/**
 * Release ownership (e.g. when the user pauses or stops).
 */
export function releasePlayback(id: string): void {
  if (activeId === id) {
    activeId = null;
  }
}
