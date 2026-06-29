import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { Song, SongMetadata, SongMetadataSchema } from "./schema";

const SONGS_DIR = path.join(process.cwd(), "data", "songs");

export function parseSections(body: string): { lyrics: string; notes: string } {
  const lyricsIndex = body.indexOf("## Lyrics");
  const notesIndex = body.indexOf("## Notes");

  let lyrics = "";
  let notes = "";

  if (lyricsIndex !== -1) {
    const start = lyricsIndex + "## Lyrics".length;
    const end = notesIndex !== -1 && notesIndex > lyricsIndex ? notesIndex : body.length;
    lyrics = body.substring(start, end).trim();
  }

  if (notesIndex !== -1) {
    const start = notesIndex + "## Notes".length;
    const end = lyricsIndex !== -1 && lyricsIndex > notesIndex ? lyricsIndex : body.length;
    notes = body.substring(start, end).trim();
  }

  // Fallback: if no section headers, treat the entire body as lyrics
  if (lyricsIndex === -1 && notesIndex === -1) {
    lyrics = body.trim();
  }

  return { lyrics, notes };
}

export async function loadSong(language: string, slug: string): Promise<Song> {
  const songMdPath = path.join(SONGS_DIR, language, `${slug}.md`);
  const rawContent = await fs.readFile(songMdPath, "utf-8");

  const { data, content: body } = matter(rawContent);

  // Validate frontmatter metadata
  const meta = SongMetadataSchema.parse(data);

  // Parse lyrics and notes from Markdown body
  const { lyrics, notes } = parseSections(body);

  // Load each referenced ABC notation file
  const abcNotations = await Promise.all(
    meta.abcNotations.map(async (notation) => {
      const abcPath = path.join(SONGS_DIR, language, `${slug}.${notation.type}.abc`);
      const content = await fs.readFile(abcPath, "utf-8");
      return {
        ...notation,
        content,
      };
    })
  );

  return {
    meta,
    lyrics,
    notes,
    abcNotations,
  };
}

export async function listSongs(): Promise<SongMetadata[]> {
  const songs: SongMetadata[] = [];

  try {
    const languages = await fs.readdir(SONGS_DIR, { withFileTypes: true });

    for (const langDir of languages) {
      if (!langDir.isDirectory()) continue;

      const langPath = path.join(SONGS_DIR, langDir.name);
      const files = await fs.readdir(langPath, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".md")) continue;

        const filePath = path.join(langPath, file.name);
        const rawContent = await fs.readFile(filePath, "utf-8");
        const { data } = matter(rawContent);

        try {
          const meta = SongMetadataSchema.parse(data);
          songs.push(meta);
        } catch (err) {
          // If we fail to parse, throw or ignore. For listSongs we can propagate the error or log it.
          console.error(`Error parsing song metadata in ${filePath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Error listing songs:", err);
    throw err;
  }

  return songs;
}

export async function loadAllSongs(): Promise<Song[]> {
  const songs: Song[] = [];

  try {
    const languages = await fs.readdir(SONGS_DIR, { withFileTypes: true });

    for (const langDir of languages) {
      if (!langDir.isDirectory()) continue;

      const langPath = path.join(SONGS_DIR, langDir.name);
      const files = await fs.readdir(langPath, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".md")) continue;

        const slug = file.name.slice(0, -3);
        try {
          const song = await loadSong(langDir.name, slug);
          songs.push(song);
        } catch (err) {
          console.error(`Error loading song ${langDir.name}/${slug}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("Error loading all songs:", err);
  }

  return songs;
}
