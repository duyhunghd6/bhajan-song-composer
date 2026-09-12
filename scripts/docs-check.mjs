#!/usr/bin/env node
// Documentation guardrail. Run with `npm run docs:check`.
//
// Four independent checks over the documentation set (root docs + docs/**/*.md):
//   1. Universal ID extractor (Beads ID metadata) — warning-only when python is unavailable.
//   2. Relative markdown links resolve to existing files.
//   3. Repo-relative paths in backticks (src/, docs/, data/, scripts/, public/, .agents/) exist.
//   4. No `file:///` URLs (they break for every other contributor).
//
// Whitelist for check 3: put `<!-- docs-check: ignore-paths -->` on its own line. It
// suppresses path checks for the next non-blank line, or — when the next line opens a
// fenced code block — for the whole block. Use it for historical or hypothetical trees.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_DOCS = ["README.md", "CLAUDE.md", "CONTEXT.md", "ARCHITECTURE.md"];
const DOCS_DIR = "docs";
// Skill docs link into docs/guides. They are vendored and use paths relative to their own
// folder, so they get a links-only scan that flags only links leaving the skill directory.
const LINKS_ONLY_DIRS = [".claude/skills"];
// Bare filenames (`HarmonyStep.tsx`, `abcjs-playback/render-input.ts`) are the dominant
// style in CLAUDE.md/ARCHITECTURE.md; resolve them by basename under these roots.
const BARE_FILE_ROOTS = ["src", "scripts", "e2e"];
const BARE_FILE_EXT = /\.(ts|tsx|mjs)$/;
const EXTRACTOR = ".agents/skills/agenticse-gmind-universal-id-agentmem/scripts/extract_ids.py";
const IGNORE_MARKER = "<!-- docs-check: ignore-paths -->";
const PATH_PREFIXES = ["src/", "docs/", "data/", "scripts/", "public/", ".agents/", ".claude/"];

function listMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listMarkdown(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

const files = [
  ...ROOT_DOCS.filter((f) => existsSync(path.join(repoRoot, f))),
  ...listMarkdown(path.join(repoRoot, DOCS_DIR)).map((f) => path.relative(repoRoot, f)),
].sort();
const linksOnlyFiles = LINKS_ONLY_DIRS.filter((d) => existsSync(path.join(repoRoot, d))).flatMap((d) =>
  listMarkdown(path.join(repoRoot, d)).map((f) => path.relative(repoRoot, f)),
);

const errors = { extractor: [], ids: [], links: [], paths: [], bareFiles: [], fileUrls: [] };
const warnings = [];

// Basename index for bare-filename resolution.
const basenameIndex = new Map();
function indexBasenames(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) indexBasenames(full);
    else if (BARE_FILE_EXT.test(entry)) {
      const rel = path.relative(repoRoot, full);
      if (!basenameIndex.has(entry)) basenameIndex.set(entry, []);
      basenameIndex.get(entry).push(rel);
    }
  }
}
for (const root of BARE_FILE_ROOTS) indexBasenames(path.join(repoRoot, root));
// Top-level config files (`next.config.ts`, `vitest.config.ts`, ...) are cited by name too.
for (const entry of readdirSync(repoRoot)) {
  if (BARE_FILE_EXT.test(entry) && statSync(path.join(repoRoot, entry)).isFile()) {
    if (!basenameIndex.has(entry)) basenameIndex.set(entry, []);
    basenameIndex.get(entry).push(entry);
  }
}

function bareFileExists(token) {
  // `HarmonyStep.tsx` or `workspace/HarmonyStep.tsx`: match on basename, then require the
  // full token to be a path suffix of an indexed file.
  const hits = basenameIndex.get(path.basename(token)) ?? [];
  return hits.some((rel) => rel === token || rel.endsWith("/" + token));
}

// ---------------------------------------------------------------- 1. extractor
function runExtractor() {
  const candidates = ["python", "python3"];
  for (const bin of candidates) {
    const probe = spawnSync(bin, ["--version"], { cwd: repoRoot, encoding: "utf8" });
    if (probe.error || probe.status !== 0) continue;
    const res = spawnSync(bin, [EXTRACTOR, DOCS_DIR], { cwd: repoRoot, encoding: "utf8" });
    if (res.status !== 0) {
      const detail = (res.stdout + res.stderr).trim().split("\n").filter(Boolean);
      errors.extractor.push(`${EXTRACTOR}: exit ${res.status}`, ...detail.map((l) => `  ${l}`));
      return;
    }
    auditIds(res.stdout);
    return;
  }
  const msg = `Universal ID extractor skipped: no python/python3 on PATH (would run \`python ${EXTRACTOR} ${DOCS_DIR}\`).`;
  if (process.env.CI) errors.extractor.push(`${msg} Treated as an error because CI is set.`);
  else warnings.push(msg);
}

// The extractor validates syntax only. It prints a JSON array of
// { id, file, line, satisfies[] } followed by a status line; audit id uniqueness and that
// every `satisfies` target resolves to an active id.
function auditIds(stdout) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  if (start === -1 || end === -1) {
    errors.ids.push("could not locate the extractor JSON array in its output");
    return;
  }
  let entries;
  try {
    entries = JSON.parse(stdout.slice(start, end + 1));
  } catch (err) {
    errors.ids.push(`could not parse extractor JSON: ${err.message}`);
    return;
  }
  const seen = new Map();
  for (const e of entries) {
    const first = seen.get(e.id);
    if (first) errors.ids.push(`${e.file}:${e.line}: duplicate beads-id ${e.id} (first at ${first.file}:${first.line})`);
    else seen.set(e.id, e);
  }
  for (const e of entries) {
    for (const target of e.satisfies ?? []) {
      if (!seen.has(target)) errors.ids.push(`${e.file}:${e.line}: ${e.id} satisfies unknown id ${target}`);
    }
  }
}

// ---------------------------------------------------------------- helpers
function resolveTarget(fromFile, target) {
  const abs = path.resolve(repoRoot, path.dirname(fromFile), target);
  return existsSync(abs);
}

function isExternal(target) {
  return /^(https?:|mailto:|tel:|data:)/i.test(target);
}

// ---------------------------------------------------------------- 2/3/4 per file
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const BACKTICK_RE = /`([^`\n]+)`/g;
const PATH_RE = /^(?:src|docs|data|scripts|public|\.agents|\.claude)\/[A-Za-z0-9_\-./[\]@+]*$/;

function checkFile(rel) {
  const content = readFileSync(path.join(repoRoot, rel), "utf8");
  const lines = content.split("\n");
  let inFence = false;
  let fenceLen = 0;
  let ignoreNextLine = false;
  let ignoreFence = false;

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const trimmed = line.trim();

    // 4. file:/// anywhere except a bare mention of the scheme inside backticks (rule prose).
    if (line.replace(/`[^`]*`/g, "").includes("file:///")) {
      errors.fileUrls.push(`${rel}:${lineNo}: contains file:/// URL`);
    }

    // Whitelist marker handling.
    if (trimmed === IGNORE_MARKER) {
      ignoreNextLine = true;
      return;
    }

    // A fence closes only on a bare run of the same length or longer, so a 4-backtick
    // block may contain 3-backtick fences (used by the theory carousel blocks).
    const fence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const run = fence[1];
      if (!inFence) {
        inFence = true;
        fenceLen = run.length;
        ignoreFence = ignoreNextLine;
        ignoreNextLine = false;
        return;
      }
      if (run.length >= fenceLen && line.trim() === run) {
        inFence = false;
        fenceLen = 0;
        ignoreFence = false;
        return;
      }
    }

    // Outside a fence the marker covers the following block up to the next blank line
    // (so a whole table or list can be exempted), inside a fence the whole block.
    const suppressPaths = inFence ? ignoreFence : ignoreNextLine;
    if (!inFence && trimmed === "") ignoreNextLine = false;

    // 2. relative markdown links (outside fenced code)
    if (!inFence) {
      for (const m of line.matchAll(LINK_RE)) {
        const raw = m[1];
        if (isExternal(raw) || raw.startsWith("#")) continue;
        const target = raw.split("#")[0];
        if (target === "") continue;
        if (!resolveTarget(rel, decodeURIComponent(target))) {
          errors.links.push(`${rel}:${lineNo}: broken link -> ${raw}`);
        }
      }
    }

    // 3. backtick repo-relative paths (inside fences too: docs quote trees there)
    if (suppressPaths) return;
    const candidates = inFence
      ? line.trim().split(/\s+/).filter((tok) => PATH_PREFIXES.some((p) => tok.startsWith(p)))
      : [...line.matchAll(BACKTICK_RE)].map((m) => m[1].trim());
    for (const token of candidates) {
      // Trim tree-drawing / punctuation noise around a token.
      const cleaned = token.replace(/^[│├└─\s]+/, "").replace(/[,;:)]+$/, "");
      if (!inFence && !PATH_RE.test(cleaned) && BARE_FILE_EXT.test(cleaned)) {
        // Bare filename or partial path such as `workspace/HarmonyStep.tsx`.
        if (/[*{}<>\s]/.test(cleaned) || cleaned.startsWith(".")) continue;
        if (!/^[A-Za-z0-9_\-./[\]@+]+$/.test(cleaned)) continue;
        if (!bareFileExists(cleaned)) {
          errors.bareFiles.push(`${rel}:${lineNo}: file not found under ${BARE_FILE_ROOTS.join(", ")} -> ${cleaned}`);
        }
        continue;
      }
      if (!PATH_RE.test(cleaned)) continue;
      // Only check tokens that look like a file (has extension) or explicit directory (trailing /).
      const looksLikeFile = /\.[A-Za-z0-9]+$/.test(cleaned);
      const looksLikeDir = cleaned.endsWith("/");
      if (!looksLikeFile && !looksLikeDir) continue;
      // Glob-ish or template tokens are documentation notation, not concrete paths.
      if (/[*{}<>]/.test(cleaned)) continue;
      if (!existsSync(path.join(repoRoot, cleaned))) {
        errors.paths.push(`${rel}:${lineNo}: path not found -> ${cleaned}`);
      }
    }
  });
}

// ---------------------------------------------------------------- run
// Links-only scan for vendored skill docs: report a broken link only when its target
// resolves outside the skills tree (e.g. into docs/ or the repo root). Links between
// skills are the skill vendor's concern, not this repository's documentation.
function checkLinksOnly(rel) {
  const content = readFileSync(path.join(repoRoot, rel), "utf8");
  const skillDir = rel.split("/").slice(0, 2).join("/"); // .claude/skills
  content.split("\n").forEach((line, idx) => {
    for (const m of line.matchAll(LINK_RE)) {
      const raw = m[1];
      if (isExternal(raw) || raw.startsWith("#")) continue;
      const target = raw.split("#")[0];
      if (target === "") continue;
      const abs = path.resolve(repoRoot, path.dirname(rel), decodeURIComponent(target));
      const relTarget = path.relative(repoRoot, abs);
      if (relTarget.startsWith(skillDir)) continue;
      if (!existsSync(abs)) errors.links.push(`${rel}:${idx + 1}: broken link -> ${raw}`);
    }
  });
}

runExtractor();
for (const rel of files) checkFile(rel);
for (const rel of linksOnlyFiles) checkLinksOnly(rel);

const groups = [
  ["Universal ID extractor", errors.extractor],
  ["Universal ID uniqueness / satisfies audit", errors.ids],
  ["Broken relative links", errors.links],
  ["Missing backtick paths", errors.paths],
  ["Missing bare filenames", errors.bareFiles],
  ["file:/// URLs", errors.fileUrls],
];
const total = groups.reduce((n, [, list]) => n + list.length, 0);

console.log(`docs-check: scanned ${files.length} markdown files (+${linksOnlyFiles.length} skill files, links only)`);
for (const [name, list] of groups) console.log(`  ${name}: ${list.length}`);
for (const w of warnings) console.log(`  WARN ${w}`);
for (const [name, list] of groups) {
  if (list.length === 0) continue;
  console.log(`\n## ${name}`);
  for (const e of list) console.log(e);
}
console.log(total === 0 ? "\ndocs-check PASSED" : `\ndocs-check FAILED (${total} errors)`);
process.exit(total === 0 ? 0 : 1);
