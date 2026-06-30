"use client";

import { useEffect, useMemo, useState } from "react";
import { SongMetadata, SongMetadataSchema } from "@/lib/songs/schema";

const DEFAULT_STORAGE_KEY = "bhajan-song-composer:song-form:draft";

const DEFAULT_METADATA: SongMetadata = {
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

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const quoteYaml = (value: string) => JSON.stringify(value);

const formatYamlList = (items: string[]) => `[${items.map(quoteYaml).join(", ")}]`;

function metadataToYaml(metadata: SongMetadata) {
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

export default function SongForm({
  initialMetadata = DEFAULT_METADATA,
  storageKey = DEFAULT_STORAGE_KEY,
  onChange,
}: SongFormProps) {
  const [metadata, setMetadata] = useState<SongMetadata>(initialMetadata);
  const [storageStatus, setStorageStatus] = useState("Metadata saves locally in this browser.");
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  const validation = useMemo(() => SongMetadataSchema.safeParse(metadata), [metadata]);
  const yamlPreview = useMemo(() => metadataToYaml(metadata), [metadata]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        const savedDraft = window.localStorage.getItem(storageKey);
        if (savedDraft) {
          const parsed = SongMetadataSchema.safeParse(JSON.parse(savedDraft));
          if (parsed.success) {
            setMetadata(parsed.data);
            setStorageStatus("Loaded saved metadata from this browser.");
          } else {
            setStorageStatus("Saved metadata is incomplete. Edit the form to repair it.");
          }
        }
      } catch (err) {
        console.error("Error loading song metadata draft:", err);
        setStorageStatus("Local metadata loading is unavailable in this browser.");
      } finally {
        setHasLoadedStorage(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [storageKey]);

  useEffect(() => {
    onChange?.(metadata);
  }, [metadata, onChange]);

  useEffect(() => {
    if (!hasLoadedStorage || typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(metadata));
        setStorageStatus("Metadata draft saved locally in this browser.");
      } catch (err) {
        console.error("Error saving song metadata draft:", err);
        setStorageStatus("Local metadata saving is unavailable in this browser.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasLoadedStorage, metadata, storageKey]);

  const updateField = <K extends keyof SongMetadata>(field: K, value: SongMetadata[K]) => {
    setMetadata((current) => ({ ...current, [field]: value }));
  };

  const updateVideo = <K extends keyof SongMetadata["videos"][number]>(
    index: number,
    field: K,
    value: SongMetadata["videos"][number][K]
  ) => {
    setMetadata((current) => ({
      ...current,
      videos: current.videos.map((video, videoIndex) =>
        videoIndex === index ? { ...video, [field]: value } : video
      ),
    }));
  };

  const updateNotation = <K extends keyof SongMetadata["abcNotations"][number]>(
    index: number,
    field: K,
    value: SongMetadata["abcNotations"][number][K]
  ) => {
    setMetadata((current) => ({
      ...current,
      abcNotations: current.abcNotations.map((notation, notationIndex) =>
        notationIndex === index ? { ...notation, [field]: value } : notation
      ),
    }));
  };

  const setDefaultVideo = (index: number) => {
    setMetadata((current) => ({
      ...current,
      videos: current.videos.map((video, videoIndex) => ({
        ...video,
        default: videoIndex === index,
      })),
    }));
  };

  const setDefaultNotation = (index: number) => {
    setMetadata((current) => ({
      ...current,
      abcNotations: current.abcNotations.map((notation, notationIndex) => ({
        ...notation,
        default: notationIndex === index,
      })),
    }));
  };

  const addVideo = () => {
    setMetadata((current) => ({
      ...current,
      videos: [
        ...current.videos,
        {
          type: "backing-track",
          url: "https://www.youtube.com/watch?v=",
          label: "Backing Track",
        },
      ],
    }));
  };

  const removeVideo = (index: number) => {
    setMetadata((current) => {
      const videos = current.videos.filter((_, videoIndex) => videoIndex !== index);
      return { ...current, videos };
    });
  };

  const addNotation = () => {
    setMetadata((current) => ({
      ...current,
      abcNotations: [
        ...current.abcNotations,
        {
          type: "backing-track",
          label: "Backing Track",
        },
      ],
    }));
  };

  const removeNotation = (index: number) => {
    setMetadata((current) => ({
      ...current,
      abcNotations: current.abcNotations.filter((_, notationIndex) => notationIndex !== index),
    }));
  };

  const clearSavedDraft = () => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(storageKey);
      setMetadata(initialMetadata);
      setStorageStatus("Metadata draft cleared. The starter form has been restored.");
    } catch (err) {
      console.error("Error clearing song metadata draft:", err);
      setStorageStatus("Could not clear the saved metadata draft in this browser.");
    }
  };

  return (
    <section className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-md overflow-hidden">
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-5">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Song Metadata
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Fill frontmatter fields with schema-aware validation before writing YAML.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full border ${
              validation.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
            }`}
          >
            {validation.success ? "Schema valid" : "Needs schema fixes"}
          </span>
          <button
            type="button"
            onClick={clearSavedDraft}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
          >
            Clear metadata draft
          </button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="p-5 space-y-6 border-b xl:border-b-0 xl:border-r border-zinc-100 dark:border-zinc-800">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="song-title"
              label="Title"
              value={metadata.title}
              onChange={(value) => updateField("title", value)}
              required
            />
            <TextField
              id="song-slug"
              label="Slug"
              value={metadata.slug}
              onChange={(value) => updateField("slug", value)}
              required
            />
            <TextField
              id="song-language"
              label="Language"
              value={metadata.language}
              onChange={(value) => updateField("language", value)}
              required
            />
            <TextField
              id="song-category"
              label="Category"
              value={metadata.category}
              onChange={(value) => updateField("category", value)}
              required
            />
            <TextField
              id="song-raga"
              label="Raga"
              value={metadata.raga ?? ""}
              onChange={(value) => updateField("raga", value)}
            />
            <TextField
              id="song-taal"
              label="Taal"
              value={metadata.taal ?? ""}
              onChange={(value) => updateField("taal", value)}
            />
            <TextField
              id="song-key"
              label="Key"
              value={metadata.key}
              onChange={(value) => updateField("key", value)}
              required
            />
            <TextField
              id="song-time-signature"
              label="Time signature"
              value={metadata.timeSignature}
              onChange={(value) => updateField("timeSignature", value)}
              required
            />
            <TextField
              id="song-tags"
              label="Tags (comma separated)"
              value={metadata.tags.join(", ")}
              onChange={(value) => updateField("tags", splitList(value))}
              required
              className="md:col-span-2"
            />
            <TextField
              id="song-composer"
              label="Composer"
              value={metadata.composer ?? ""}
              onChange={(value) => updateField("composer", value)}
            />
            <TextField
              id="song-contributors"
              label="Contributors (comma separated)"
              value={metadata.contributors?.join(", ") ?? ""}
              onChange={(value) => updateField("contributors", splitList(value))}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                YouTube video resources
              </h3>
              <button
                type="button"
                onClick={addVideo}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
              >
                Add video
              </button>
            </div>
            <div className="space-y-3">
              {metadata.videos.map((video, index) => (
                <div
                  key={`video-${index}`}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4 space-y-3"
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <TextField
                      id={`video-type-${index}`}
                      label="Type"
                      value={video.type}
                      onChange={(value) => updateVideo(index, "type", value)}
                      required
                    />
                    <TextField
                      id={`video-label-${index}`}
                      label="Label"
                      value={video.label}
                      onChange={(value) => updateVideo(index, "label", value)}
                      required
                    />
                    <TextField
                      id={`video-url-${index}`}
                      label="URL"
                      value={video.url}
                      onChange={(value) => updateVideo(index, "url", value)}
                      required
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      <input
                        type="radio"
                        name="default-video"
                        checked={video.default === true}
                        onChange={() => setDefaultVideo(index)}
                        className="accent-amber-500"
                      />
                      Default video
                    </label>
                    <button
                      type="button"
                      onClick={() => removeVideo(index)}
                      disabled={metadata.videos.length === 1}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 disabled:text-zinc-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Remove video
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                ABC notation layers
              </h3>
              <button
                type="button"
                onClick={addNotation}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
              >
                Add layer
              </button>
            </div>
            <div className="space-y-3">
              {metadata.abcNotations.map((notation, index) => (
                <div
                  key={`notation-${index}`}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 p-4 space-y-3"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField
                      id={`notation-type-${index}`}
                      label="Type"
                      value={notation.type}
                      onChange={(value) => updateNotation(index, "type", value)}
                      required
                    />
                    <TextField
                      id={`notation-label-${index}`}
                      label="Label"
                      value={notation.label}
                      onChange={(value) => updateNotation(index, "label", value)}
                      required
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      <input
                        type="radio"
                        name="default-notation"
                        checked={notation.default === true}
                        onChange={() => setDefaultNotation(index)}
                        className="accent-amber-500"
                      />
                      Default layer
                    </label>
                    <button
                      type="button"
                      onClick={() => removeNotation(index)}
                      disabled={metadata.abcNotations.length === 1}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 disabled:text-zinc-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Remove layer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">{storageStatus}</p>
        </div>

        <aside className="p-5 space-y-3 bg-zinc-50/70 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              YAML frontmatter preview
            </h3>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Copy into data/songs
            </span>
          </div>

          {!validation.success && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {validation.error.issues.slice(0, 4).map((issue) => (
                <p key={`${issue.path.join(".")}-${issue.message}`}>
                  <strong>{issue.path.join(".") || "metadata"}:</strong> {issue.message}
                </p>
              ))}
            </div>
          )}

          <textarea
            id="song-metadata-yaml-preview"
            value={yamlPreview}
            readOnly
            spellCheck={false}
            className="min-h-[640px] w-full resize-y rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 font-mono text-xs leading-5 text-zinc-800 dark:text-zinc-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </aside>
      </div>
    </section>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

function TextField({ id, label, value, onChange, required = false, className = "" }: TextFieldProps) {
  return (
    <label className={`block space-y-1.5 ${className}`} htmlFor={id}>
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-zinc-400"
      />
    </label>
  );
}
