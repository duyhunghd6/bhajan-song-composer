#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import abcjs from "abcjs";
import { z } from "zod";

const SongVideoSchema = z.object({
  type: z.string(),
  url: z.string().url(),
  label: z.string(),
  default: z.boolean().optional(),
});

const SongAbcNotationSchema = z.object({
  type: z.string(),
  label: z.string(),
  default: z.boolean().optional(),
});

const SongMetadataSchema = z.object({
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

const REQUIRED_ABC_HEADERS = ["X", "T", "M", "K"];

function issue(pathname, message, field) {
  return { path: pathname, field, message };
}

function hasHeader(content, header) {
  return new RegExp(`^${header}:\\s*\\S+`, "m").test(content);
}

function abcBody(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !/^[A-Z]:/.test(line))
    .join(" ");
}

function stripHtml(content) {
  return content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function validateAbcNotation(content, pathname) {
  if (!content.trim()) {
    return [issue(pathname, "ABC notation is empty")];
  }

  const issues = [];
  for (const header of REQUIRED_ABC_HEADERS) {
    if (!hasHeader(content, header)) {
      issues.push(issue(pathname, `ABC notation is missing required ${header}: header`));
    }
  }

  const body = abcBody(content);
  const hasNoteToken = /(?:\[[^\]]*[A-Ga-g][^\]]*\]|[_^=]?[A-Ga-g][,']*[0-9]*\/?[0-9]*)/.test(body);
  if (!body || !hasNoteToken) {
    issues.push(issue(pathname, "ABC notation must contain at least one parseable note or chord token"));
  }

  try {
    const tunes = abcjs.parseOnly(content);
    if (!Array.isArray(tunes) || tunes.length === 0) {
      issues.push(issue(pathname, "ABC notation parser did not produce a tune"));
    }

    const warnings = tunes.flatMap((tune) => tune.warnings ?? []);
    for (const warning of warnings) {
      issues.push(issue(pathname, `ABC parser warning: ${stripHtml(warning)}`));
    }
  } catch (error) {
    issues.push(issue(pathname, error instanceof Error ? `ABC notation could not be parsed: ${error.message}` : "ABC notation could not be parsed"));
  }

  return issues;
}

function validateSongMarkdown(markdown, pathname) {
  try {
    const parsed = matter(markdown);
    const result = SongMetadataSchema.safeParse(parsed.data);
    if (result.success) {
      return { metadata: result.data, issues: [] };
    }

    return {
      issues: result.error.issues.map((zodIssue) =>
        issue(pathname, zodIssue.message, zodIssue.path.length > 0 ? zodIssue.path.join(".") : undefined)
      ),
    };
  } catch (error) {
    return {
      issues: [issue(pathname, error instanceof Error ? `YAML frontmatter could not be parsed: ${error.message}` : "YAML frontmatter could not be parsed")],
    };
  }
}

async function validateSongLibrary(songsDir) {
  const issues = [];
  let songs = 0;
  let abcFiles = 0;

  let languageEntries;
  try {
    languageEntries = await fs.readdir(songsDir, { withFileTypes: true });
  } catch (error) {
    return {
      valid: false,
      issues: [issue(path.relative(process.cwd(), songsDir), error instanceof Error ? error.message : "Could not read songs directory")],
      checked: { songs, abcFiles },
    };
  }

  for (const languageEntry of languageEntries) {
    if (!languageEntry.isDirectory()) continue;

    const languageDir = path.join(songsDir, languageEntry.name);
    const entries = await fs.readdir(languageDir, { withFileTypes: true });
    const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

      songs += 1;
      const markdownPath = path.join(languageDir, entry.name);
      const relativeMarkdownPath = path.relative(process.cwd(), markdownPath);
      const markdown = await fs.readFile(markdownPath, "utf-8");
      const metadataResult = validateSongMarkdown(markdown, relativeMarkdownPath);
      issues.push(...metadataResult.issues);

      if (!metadataResult.metadata) continue;

      const expectedSlug = entry.name.slice(0, -3);
      if (metadataResult.metadata.slug !== expectedSlug) {
        issues.push(issue(relativeMarkdownPath, `Metadata slug must match filename slug "${expectedSlug}"`, "slug"));
      }
      if (metadataResult.metadata.language !== languageEntry.name) {
        issues.push(issue(relativeMarkdownPath, `Metadata language must match directory "${languageEntry.name}"`, "language"));
      }

      for (const notation of metadataResult.metadata.abcNotations) {
        const abcFileName = `${expectedSlug}.${notation.type}.abc`;
        const abcPath = path.join(languageDir, abcFileName);
        const relativeAbcPath = path.relative(process.cwd(), abcPath);

        if (!files.has(abcFileName)) {
          issues.push(issue(relativeAbcPath, `Referenced ABC notation file is missing for type "${notation.type}"`));
          continue;
        }

        abcFiles += 1;
        const abc = await fs.readFile(abcPath, "utf-8");
        issues.push(...validateAbcNotation(abc, relativeAbcPath));
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    checked: { songs, abcFiles },
  };
}

function parseArgs(argv) {
  const args = { songsDir: path.join(process.cwd(), "data", "songs") };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--songs-dir") {
      args.songsDir = path.resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log("Usage: node scripts/validate-songs.mjs [--songs-dir data/songs]");
  process.exit(0);
}

const report = await validateSongLibrary(args.songsDir);
console.log(JSON.stringify(report, null, 2));
process.exit(report.valid ? 0 : 1);
