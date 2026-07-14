"use server";

import fs from "fs/promises";
import path from "path";
import { SongMetadata, SongMetadataSchema } from "@/lib/songs/schema";
import { metadataToYaml } from "@/components/composer/song-form/metadata";
import { revalidatePath } from "next/cache";

const SONGS_DIR = path.join(process.cwd(), "data", "songs");

export async function saveSongMetadataToDisk(metadata: SongMetadata) {
  try {
    // 1. Validate the metadata
    const validMeta = SongMetadataSchema.parse(metadata);
    const { language, slug, abcNotations } = validMeta;

    // 2. Ensure language directory exists
    const langDir = path.join(SONGS_DIR, language.toLowerCase());
    await fs.mkdir(langDir, { recursive: true });

    // 3. Write markdown file (YAML frontmatter + sections)
    const mdPath = path.join(langDir, `${slug}.md`);
    const yaml = metadataToYaml(validMeta);
    const mdContent = `${yaml}\n\n## Lyrics\n\n\n## Notes\n\n`;
    await fs.writeFile(mdPath, mdContent, "utf-8");

    // 4. Write starter ABC files if they don't exist
    for (const notation of abcNotations) {
      const abcPath = path.join(langDir, `${slug}.${notation.type}.abc`);
      try {
        await fs.access(abcPath);
      } catch {
        // File does not exist, write a starter template
        const defaultAbc = `X: 1
T: ${validMeta.title}
C: ${validMeta.composer || "Traditional"}
M: ${validMeta.timeSignature || "4/4"}
L: 1/8
K: ${validMeta.key || "C"}
% ${notation.label} starts here
`;
        await fs.writeFile(abcPath, defaultAbc, "utf-8");
      }
    }

    // Next.js: Revalidate the edit path so it picks up the new files immediately
    revalidatePath("/edit");
    revalidatePath(`/compose/${slug}`);

    return { success: true };
  } catch (error) {
    console.error("Error saving song to disk:", error);
    return { success: false, error: String(error) };
  }
}
