import { vi, describe, it, expect, beforeEach } from "vitest";
import { loadSong, listSongs } from "../loader";
import fs from "fs/promises";
import { Dirent, Stats } from "fs";

vi.mock("fs/promises", () => {
  return {
    default: {
      readFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
    },
  };
});

describe("Song Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleMarkdown = `---
title: "Namostute"
slug: "namostute"
language: "marathi"
category: "praise"
raga: "Bhairav"
taal: "Teentaal"
key: "Em"
timeSignature: "4/4"
videos:
  - type: "beat-karaoke"
    url: "https://youtube.com/watch?v=abcdef"
    label: "Beat Karaoke"
    default: true
abcNotations:
  - type: "melody"
    label: "Melody Music Sheet"
    default: true
tags: ["bhajan", "marathi"]
---

## Lyrics

Namostute Namostute
Shri Mataji Namostute

## Notes

This is a marathi bhajan in praise of Shri Mataji.
`;

  it("loads a song with correct metadata, lyrics, notes, and ABC content", async () => {
    // Mock the markdown file read
    vi.mocked(fs.readFile).mockImplementation((path: unknown) => {
      const pathStr = path as string;
      if (pathStr.endsWith("namostute.md")) {
        return Promise.resolve(sampleMarkdown);
      }
      if (pathStr.endsWith("namostute.melody.abc")) {
        return Promise.resolve("X:1\nT:Namostute\nM:4/4\nK:Em\nE E G A | B B A G");
      }
      return Promise.reject(new Error("File not found"));
    });

    const song = await loadSong("marathi", "namostute");
    expect(song.meta.title).toBe("Namostute");
    expect(song.meta.slug).toBe("namostute");
    expect(song.lyrics).toContain("Namostute Namostute");
    expect(song.notes).toContain("in praise of Shri Mataji");
    expect(song.abcNotations).toHaveLength(1);
    expect(song.abcNotations[0].content).toBe("X:1\nT:Namostute\nM:4/4\nK:Em\nE E G A | B B A G");
  });

  it("throws an error if the markdown file fails schema validation", async () => {
    const invalidMarkdown = `---
title: "Namostute"
slug: "namostute"
language: "marathi"
# Missing category, key, etc.
---
`;
    vi.mocked(fs.readFile).mockResolvedValue(invalidMarkdown);

    await expect(loadSong("marathi", "namostute")).rejects.toThrow();
  });

  it("throws an error if a companion ABC file is missing", async () => {
    vi.mocked(fs.readFile).mockImplementation((path: unknown) => {
      const pathStr = path as string;
      if (pathStr.endsWith("namostute.md")) {
        return Promise.resolve(sampleMarkdown);
      }
      return Promise.reject(new Error("File not found"));
    });

    await expect(loadSong("marathi", "namostute")).rejects.toThrow();
  });

  it("lists all songs across subdirectories", async () => {
    // @ts-expect-error - Custom readdir mock implementation returns Dirent mock matching expected directory shape
    vi.mocked(fs.readdir).mockImplementation((path: unknown) => {
      const pathStr = path as string;
      if (pathStr.endsWith("songs")) {
        return Promise.resolve([
          { name: "marathi", isDirectory: () => true, isFile: () => false },
          { name: "hindi", isDirectory: () => true, isFile: () => false },
        ] as unknown as Dirent[]);
      }
      if (pathStr.endsWith("marathi")) {
        return Promise.resolve([
          { name: "namostute.md", isDirectory: () => false, isFile: () => true },
          { name: "namostute.melody.abc", isDirectory: () => false, isFile: () => true },
        ] as unknown as Dirent[]);
      }
      if (pathStr.endsWith("hindi")) {
        return Promise.resolve([
          { name: "ignore.txt", isDirectory: () => false, isFile: () => true },
        ] as unknown as Dirent[]);
      }
      return Promise.resolve([]);
    });

    vi.mocked(fs.stat).mockImplementation((path: unknown) => {
      const pathStr = path as string;
      const isDir = pathStr.endsWith("songs") || pathStr.endsWith("marathi") || pathStr.endsWith("hindi");
      return Promise.resolve({
        isDirectory: () => isDir,
        isFile: () => !isDir,
      } as unknown as Stats);
    });

    vi.mocked(fs.readFile).mockResolvedValue(sampleMarkdown);

    const songs = await listSongs();
    expect(songs).toHaveLength(1);
    expect(songs[0].slug).toBe("namostute");
    expect(songs[0].language).toBe("marathi");
  });
});
