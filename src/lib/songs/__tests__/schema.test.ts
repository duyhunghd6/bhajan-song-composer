import { describe, expect, it } from "vitest";
import { SongMetadataSchema } from "../schema";

describe("SongMetadataSchema", () => {
  const baseValidMetadata = {
    title: "Namostute",
    slug: "namostute",
    language: "marathi",
    category: "praise",
    raga: "Bhairav",
    taal: "Teentaal",
    key: "Em",
    timeSignature: "4/4",
    videos: [
      {
        type: "beat-karaoke",
        url: "https://youtube.com/watch?v=abcdef",
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
    tags: ["bhajan", "marathi"],
    composer: "Traditional",
    contributors: ["community"],
  };

  it("successfully parses valid metadata", () => {
    const result = SongMetadataSchema.safeParse(baseValidMetadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Namostute");
      expect(result.data.slug).toBe("namostute");
      expect(result.data.language).toBe("marathi");
      expect(result.data.category).toBe("praise");
      expect(result.data.raga).toBe("Bhairav");
      expect(result.data.taal).toBe("Teentaal");
      expect(result.data.key).toBe("Em");
      expect(result.data.timeSignature).toBe("4/4");
      expect(result.data.videos[0].type).toBe("beat-karaoke");
      expect(result.data.videos[0].url).toBe("https://youtube.com/watch?v=abcdef");
      expect(result.data.abcNotations[0].type).toBe("melody");
      expect(result.data.tags).toContain("bhajan");
    }
  });

  it("fails if required fields are missing", () => {
    const invalid = { ...baseValidMetadata };
    // @ts-ignore
    delete invalid.title;
    const result = SongMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("fails if videos have invalid url structure", () => {
    const invalid = {
      ...baseValidMetadata,
      videos: [
        {
          type: "beat-karaoke",
          url: "not-a-url",
          label: "Invalid Video",
        },
      ],
    };
    const result = SongMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("allows optional fields like raga, composer, contributors to be omitted", () => {
    const metadata = { ...baseValidMetadata };
    delete metadata.raga;
    delete metadata.composer;
    delete metadata.contributors;

    const result = SongMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });
});
