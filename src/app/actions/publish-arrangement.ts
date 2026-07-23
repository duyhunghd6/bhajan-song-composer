"use server";

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { revalidatePath } from "next/cache";
import {
  COMPOSER_PUBLISHED_NOTATION_LABELS,
  getPracticeNotationPriority,
  isComposerPublishedNotationType,
  type ComposerPublishedNotationType,
} from "@/lib/songs/composer-notation";
import { SongMetadataSchema } from "@/lib/songs/schema";
import { loadAllSongs } from "@/lib/songs/loader";

const SONGS_DIR = path.join(process.cwd(), "data", "songs");

export interface PublishArrangementLayer {
  type: ComposerPublishedNotationType;
  abc: string;
}

export interface PublishArrangementInput {
  slug: string;
  layers: PublishArrangementLayer[];
}

export type PublishArrangementResult =
  | { success: true; practiceHref: string; publishedTypes: ComposerPublishedNotationType[] }
  | { success: false; error: string };

function validateInput(input: PublishArrangementInput): string | null {
  if (!input.slug.trim()) return "Song slug is required.";
  if (input.layers.length === 0) return "Select at least one notation layer to publish.";

  const seen = new Set<string>();
  for (const layer of input.layers) {
    if (!isComposerPublishedNotationType(layer.type)) return `Unsupported notation type: ${layer.type}`;
    if (seen.has(layer.type)) return `Notation type is selected more than once: ${layer.type}`;
    if (!layer.abc.trim()) return `${COMPOSER_PUBLISHED_NOTATION_LABELS[layer.type]} has no ABC content.`;
    if (!/^X:\s*\S+/m.test(layer.abc) || !/^K:\s*\S+/m.test(layer.abc)) {
      return `${COMPOSER_PUBLISHED_NOTATION_LABELS[layer.type]} is missing required ABC headers.`;
    }
    seen.add(layer.type);
  }
  return null;
}

export async function publishArrangement(input: PublishArrangementInput): Promise<PublishArrangementResult> {
  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  try {
    const songs = await loadAllSongs();
    const song = songs.find((candidate) => candidate.meta.slug.toLowerCase() === input.slug.toLowerCase());
    if (!song) return { success: false, error: "Song not found in catalogue. Save metadata first." };

    const language = song.meta.language.toLowerCase();
    const slug = song.meta.slug;
    const songDirectory = path.join(SONGS_DIR, language);
    const markdownPath = path.join(songDirectory, `${slug}.md`);
    const rawMarkdown = await fs.readFile(markdownPath, "utf-8");
    const parsed = matter(rawMarkdown);
    const currentMetadata = SongMetadataSchema.parse(parsed.data);
    const publishedTypes = input.layers.map((layer) => layer.type);
    const selectedTypeSet = new Set<string>(publishedTypes);
    const preservedNotations = currentMetadata.abcNotations.filter((notation) => !selectedTypeSet.has(notation.type));
    const publishedNotations = input.layers.map((layer) => ({
      type: layer.type,
      label: COMPOSER_PUBLISHED_NOTATION_LABELS[layer.type],
      default: layer.type === "melody" && !preservedNotations.some((notation) => notation.default),
    }));
    const metadata = SongMetadataSchema.parse({
      ...currentMetadata,
      abcNotations: [...preservedNotations, ...publishedNotations],
    });
    const nextMarkdown = matter.stringify(parsed.content, metadata);

    await fs.mkdir(songDirectory, { recursive: true });
    const temporaryFiles = await Promise.all(input.layers.map(async (layer) => {
      const target = path.join(songDirectory, `${slug}.${layer.type}.abc`);
      const temporary = `${target}.publish-tmp`;
      await fs.writeFile(temporary, layer.abc.trimEnd() + "\n", "utf-8");
      return { target, temporary };
    }));
    const temporaryMarkdownPath = `${markdownPath}.publish-tmp`;
    await fs.writeFile(temporaryMarkdownPath, nextMarkdown, "utf-8");
    await Promise.all(temporaryFiles.map(({ temporary, target }) => fs.rename(temporary, target)));
    await fs.rename(temporaryMarkdownPath, markdownPath);

    revalidatePath("/edit");
    revalidatePath(`/compose/${slug}/review`);
    revalidatePath(`/practice/${slug}`);
    revalidatePath(`/${language}/${slug}`);

    const practiceType = [...publishedTypes].sort(
      (left, right) => getPracticeNotationPriority(left) - getPracticeNotationPriority(right)
    )[0];
    return {
      success: true,
      practiceHref: `/practice/${slug}?notation=${encodeURIComponent(practiceType)}`,
      publishedTypes,
    };
  } catch (error) {
    console.error("Unable to publish arrangement:", error);
    return { success: false, error: String(error) };
  }
}
