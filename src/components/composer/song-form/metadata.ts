import type { SongMetadata } from "@/lib/songs/schema";

export const DEFAULT_STORAGE_KEY = "bhajan-song-composer:song-form:draft";

export const DEFAULT_METADATA: SongMetadata = {
  title: "New Bhajan Arrangement",
  slug: "new-bhajan-arrangement",
  language: "marathi",
  category: "praise",
  raga: "",
  taal: "",
  key: "Em",
  timeSignature: "4/4",
  videos: [
    {
      type: "beat-karaoke",
      url: "https://www.youtube.com/watch?v=",
      label: "Beat Karaoke",
      default: true,
    },
  ],
  abcNotations: [
    {
      type: "melody",
      label: "Melody Music Sheet",
      default: true,
    },
  ],
  tags: ["bhajan"],
  composer: "Traditional",
  contributors: ["community"],
};

interface SongFormProps {
  initialMetadata?: SongMetadata;
  storageKey?: string;
  onChange?: (metadata: SongMetadata) => void;
}

export const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const quoteYaml = (value: string) => JSON.stringify(value);

const formatYamlList = (items: string[]) => `[${items.map(quoteYaml).join(", ")}]`;

export function metadataToYaml(metadata: SongMetadata) {
  const lines = [
    "---",
    `title: ${quoteYaml(metadata.title)}`,
    `slug: ${quoteYaml(metadata.slug)}`,
    `language: ${quoteYaml(metadata.language)}`,
    `category: ${quoteYaml(metadata.category)}`,
  ];

  if (metadata.raga) lines.push(`raga: ${quoteYaml(metadata.raga)}`);
  if (metadata.taal) lines.push(`taal: ${quoteYaml(metadata.taal)}`);

  lines.push(`key: ${quoteYaml(metadata.key)}`);
  lines.push(`timeSignature: ${quoteYaml(metadata.timeSignature)}`);
  lines.push("videos:");
  metadata.videos.forEach((video) => {
    lines.push(`  - type: ${quoteYaml(video.type)}`);
    lines.push(`    url: ${quoteYaml(video.url)}`);
    lines.push(`    label: ${quoteYaml(video.label)}`);
    if (video.default) lines.push("    default: true");
  });

  lines.push("abcNotations:");
  metadata.abcNotations.forEach((notation) => {
    lines.push(`  - type: ${quoteYaml(notation.type)}`);
    lines.push(`    label: ${quoteYaml(notation.label)}`);
    if (notation.default) lines.push("    default: true");
  });

  lines.push(`tags: ${formatYamlList(metadata.tags)}`);
  if (metadata.composer) lines.push(`composer: ${quoteYaml(metadata.composer)}`);
  if (metadata.contributors?.length) {
    lines.push(`contributors: ${formatYamlList(metadata.contributors)}`);
  }
  lines.push("---");

  return lines.join("\n");
}
