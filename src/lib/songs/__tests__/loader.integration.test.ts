import { describe, it, expect } from "vitest";
import { loadSong, listSongs, loadAllSongs } from "../loader";

describe("Song Loader Integration", () => {
  it("loads the actual namostute song from data/songs", async () => {
    const song = await loadSong("marathi", "namostute");
    expect(song.meta.title).toBe("Namostute");
    expect(song.meta.slug).toBe("namostute");
    expect(song.lyrics).toContain("Namostute Namostute");
    expect(song.abcNotations).toHaveLength(2);
    expect(song.abcNotations[0].type).toBe("melody");
    expect(song.abcNotations[1].type).toBe("backing-track");
  });

  it("lists all actual songs in data/songs", async () => {
    const songs = await listSongs();
    expect(songs.length).toBeGreaterThanOrEqual(1);
    const slugs = songs.map((s) => s.slug);
    expect(slugs).toContain("namostute");
  });

  it("loads all actual songs fully including content", async () => {
    const songs = await loadAllSongs();
    expect(songs.length).toBeGreaterThanOrEqual(1);
    const namostute = songs.find((s) => s.meta.slug === "namostute");
    expect(namostute).toBeDefined();
    expect(namostute!.meta.title).toBe("Namostute");
    expect(namostute!.lyrics).toContain("Namostute Namostute");
    expect(namostute!.abcNotations).toHaveLength(2);
  });
});
