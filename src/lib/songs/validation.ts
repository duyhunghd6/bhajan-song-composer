import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { ZodError } from "zod";
import abcjs from "abcjs";
import { analyzeMelody } from "@/lib/theory/melody-analyzer";
import { SongMetadata, SongMetadataSchema } from "./schema";

export interface ValidationIssue {
  path?: string;
  field?: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  checked: {
    songs: number;
    abcFiles: number;
  };
}

export interface SongValidationInput {
  markdown?: string;
  metadata?: unknown;
  abc?: string;
  abcNotations?: Array<{
    type?: string;
    label?: string;
    path?: string;
    content?: string;
  }>;
}

interface MetadataValidationResult {
  metadata?: SongMetadata;
  issues: ValidationIssue[];
}

const DEFAULT_SONGS_DIR = path.join(process.cwd(), "data", "songs");
const REQUIRED_ABC_HEADERS = ["X", "T", "M", "K"] as const;

function issue(pathname: string | undefined, message: string, field?: string): ValidationIssue {
  return { path: pathname, field, message };
}

function zodIssues(error: ZodError, pathname?: string): ValidationIssue[] {
  return error.issues.map((zodIssue) =>
    issue(pathname, zodIssue.message, zodIssue.path.length > 0 ? zodIssue.path.join(".") : undefined)
  );
}

function hasHeader(content: string, header: string): boolean {
  return new RegExp(`^${header}:\\s*\\S+`, "m").test(content);
}

function abcBody(content: string): string {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("%") && !/^[A-Z]:/.test(line))
    .join(" ");
}

function stripHtml(content: string): string {
  return content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function validateAbcNotation(content: string, pathname?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!content.trim()) {
    return [issue(pathname, "ABC notation is empty")];
  }

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
    issues.push(
      issue(pathname, error instanceof Error ? `ABC notation could not be parsed: ${error.message}` : "ABC notation could not be parsed")
    );
  }

  if (issues.length === 0) {
    const analysis = analyzeMelody(content);
    if (analysis.measures.length === 0) {
      issues.push(issue(pathname, "ABC notation did not produce any parseable measures"));
    }
  }

  return issues;
}

export function validateSongMetadata(metadata: unknown, pathname?: string): MetadataValidationResult {
  const result = SongMetadataSchema.safeParse(metadata);
  if (!result.success) {
    return { issues: zodIssues(result.error, pathname) };
  }

  return { metadata: result.data, issues: [] };
}

export function validateSongMarkdown(markdown: string, pathname?: string): MetadataValidationResult {
  try {
    const parsed = matter(markdown);
    return validateSongMetadata(parsed.data, pathname);
  } catch (error) {
    return {
      issues: [
        issue(
          pathname,
          error instanceof Error ? `YAML frontmatter could not be parsed: ${error.message}` : "YAML frontmatter could not be parsed"
        ),
      ],
    };
  }
}

export function validateSongSubmission(input: SongValidationInput): ValidationReport {
  const issues: ValidationIssue[] = [];
  let songs = 0;
  let abcFiles = 0;
  let sawRecognizedInput = false;

  if (typeof input.markdown === "string") {
    sawRecognizedInput = true;
    songs += 1;
    issues.push(...validateSongMarkdown(input.markdown, "submission.md").issues);
  }

  if (input.metadata !== undefined) {
    sawRecognizedInput = true;
    songs += input.markdown ? 0 : 1;
    issues.push(...validateSongMetadata(input.metadata, "metadata").issues);
  }

  if (typeof input.abc === "string") {
    sawRecognizedInput = true;
    abcFiles += 1;
    issues.push(...validateAbcNotation(input.abc, "submission.abc"));
  }

  if (Array.isArray(input.abcNotations)) {
    sawRecognizedInput = true;
    for (const [index, notation] of input.abcNotations.entries()) {
      const notationPath = notation.path ?? (notation.type ? `${notation.type}.abc` : `abcNotations.${index}.abc`);
      if (typeof notation.content !== "string") {
        issues.push(issue(notationPath, "ABC notation entry must include string content", `abcNotations.${index}.content`));
        continue;
      }
      abcFiles += 1;
      issues.push(...validateAbcNotation(notation.content, notationPath));
    }
  }

  if (!sawRecognizedInput) {
    issues.push(issue(undefined, "Provide markdown, metadata, abc, or abcNotations to validate"));
  }

  return {
    valid: issues.length === 0,
    issues,
    checked: { songs, abcFiles },
  };
}

export async function validateSongLibrary(songsDir: string = DEFAULT_SONGS_DIR): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];
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
