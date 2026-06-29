import { z } from "zod";

export const SongVideoSchema = z.object({
  type: z.string(),
  url: z.string().url(),
  label: z.string(),
  default: z.boolean().optional(),
});

export const SongAbcNotationSchema = z.object({
  type: z.string(),
  label: z.string(),
  default: z.boolean().optional(),
});

export const SongMetadataSchema = z.object({
  title: z.string(),
  slug: z.string(),
  language: z.string(),
  category: z.string(),
  raga: z.string().optional(),
  taal: z.string().optional(),
  key: z.string(),
  timeSignature: z.string(),
  videos: z.array(SongVideoSchema),
  abcNotations: z.array(SongAbcNotationSchema),
  tags: z.array(z.string()),
  composer: z.string().optional(),
  contributors: z.array(z.string()).optional(),
});

export type SongVideo = z.infer<typeof SongVideoSchema>;
export type SongAbcNotation = z.infer<typeof SongAbcNotationSchema>;
export type SongMetadata = z.infer<typeof SongMetadataSchema>;

export interface Song {
  meta: SongMetadata;
  lyrics: string;
  notes: string;
  abcNotations: Array<SongAbcNotation & { content: string }>;
}
