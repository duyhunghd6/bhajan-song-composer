import { describe, expect, it } from "vitest";
import {
  clearComposerSongStorage,
  getComposerMelodyStorageKey,
  getComposerWorkspaceStorageKey,
} from "../storage";

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe("composer song storage", () => {
  it("removes only storage entries for the requested song", () => {
    const storage = new MemoryStorage();
    storage.setItem(getComposerMelodyStorageKey("hari-bol"), "mutated abc");
    storage.setItem(getComposerWorkspaceStorageKey("hari-bol"), "{\"generatedPiano\":\"abc\"}");
    storage.setItem("bhajan-song-composer:compose:hari-bol:layers:active-layer", "harmony");
    storage.setItem(getComposerMelodyStorageKey("new-bhajan-arrangement"), "other abc");
    storage.setItem("unrelated", "keep me");

    const removedKeys = clearComposerSongStorage(storage, "hari-bol");

    expect(removedKeys.sort()).toEqual([
      "bhajan-song-composer:compose:hari-bol:layers:active-layer",
      getComposerMelodyStorageKey("hari-bol"),
      getComposerWorkspaceStorageKey("hari-bol"),
    ].sort());
    expect(storage.getItem(getComposerMelodyStorageKey("hari-bol"))).toBeNull();
    expect(storage.getItem(getComposerWorkspaceStorageKey("hari-bol"))).toBeNull();
    expect(storage.getItem(getComposerMelodyStorageKey("new-bhajan-arrangement"))).toBe("other abc");
    expect(storage.getItem("unrelated")).toBe("keep me");
  });
});
