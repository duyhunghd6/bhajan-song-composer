"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { loadAllSongs } from "@/lib/songs/loader";

const SONGS_DIR = path.join(process.cwd(), "data", "songs");

export async function saveAbcToDisk(slug: string, type: string, abcContent: string) {
  try {
    const songs = await loadAllSongs();
    const song = songs.find(s => s.meta.slug.toLowerCase() === slug.toLowerCase());
    if (!song) {
      return { success: false, error: "Song not found in catalogue. Please save metadata first." };
    }
    const language = song.meta.language;

    const langDir = path.join(SONGS_DIR, language.toLowerCase());
    
    // Ensure the language directory exists
    await fs.mkdir(langDir, { recursive: true });

    // Write the ABC file
    const abcPath = path.join(langDir, `${slug}.${type}.abc`);
    await fs.writeFile(abcPath, abcContent, "utf-8");

    // Revalidate paths so the public viewer and edit pages pick up the changes immediately
    revalidatePath("/edit");
    revalidatePath(`/${language.toLowerCase()}/${slug.toLowerCase()}`);
    revalidatePath(`/compose/${slug.toLowerCase()}`);

    return { success: true };
  } catch (error) {
    console.error("Error saving ABC to disk:", error);
    return { success: false, error: String(error) };
  }
}
