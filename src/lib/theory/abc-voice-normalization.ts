function canonicalAbcVoiceId(value: string): string {
  const compact = value.toLowerCase().replace(/[-_]/g, "");

  if (
    compact === "guitarclassic"
    || compact === "guitarclassical"
    || compact === "classicalguitar"
    || compact === "guitaracoustic"
    || compact === "acousticguitar"
  ) {
    return "Guitar";
  }

  return value;
}

export function normalizeAbcVoiceId(value: string): string {
  const cleaned = value
    .trim()
    .replace(/^\[?V:/, "")
    .replace(/^\[/, "")
    .replace(/\]+$/g, "")
    .replace(/[^A-Za-z0-9_-]/g, "");

  return cleaned ? canonicalAbcVoiceId(cleaned) : "Voice";
}

function looksLikeInlineMusicBody(value: string): boolean {
  const trimmed = value.trim();
  return /^[|:\[\]"_^=A-Ga-gzx(]/.test(trimmed);
}

export function normalizeAbcVoiceDeclarationLine(line: string): string {
  const inlineMatch = line.match(/^(\s*)V:([^\]\s]+)\]+\s*(.*)$/);
  if (inlineMatch && looksLikeInlineMusicBody(inlineMatch[3] ?? "")) {
    return `${inlineMatch[1]}[V:${normalizeAbcVoiceId(inlineMatch[2])}] ${inlineMatch[3].trim().replace(/^\]+\s*/, "")}`;
  }

  const match = line.match(/^(\s*)V:(\S+)(.*)$/);
  if (!match) return line;

  const voiceId = normalizeAbcVoiceId(match[2]);
  const rest = match[3] ?? "";

  if (/\]+$/.test(match[2]) && looksLikeInlineMusicBody(rest)) {
    return `${match[1]}[V:${voiceId}] ${rest.trim().replace(/^\]+\s*/, "")}`;
  }

  return `${match[1]}V:${voiceId}${rest}`;
}

export function normalizeAbcInlineVoiceLine(line: string): string {
  const match = line.match(/^(\s*)\[V:([^\]]+)\]\s*(.*)$/);
  if (!match) return line;

  const body = (match[3] ?? "").replace(/^\]+\s*/, "");
  return `${match[1]}[V:${normalizeAbcVoiceId(match[2])}]${body ? ` ${body}` : ""}`;
}

export function normalizeAbcScoreLine(line: string): string {
  const match = line.match(/^(\s*)%%score\s+(.+)$/);
  if (!match) return line;

  const groups: string[] = [];
  const seen = new Set<string>();
  for (const groupMatch of match[2].matchAll(/\(([^)]*)\)/g)) {
    const voices = groupMatch[1]
      .split(/\s+/)
      .map((voice) => voice.trim())
      .filter(Boolean)
      .map(normalizeAbcVoiceId);
    if (voices.length === 0) continue;

    const key = voices.join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(`(${key})`);
  }

  return groups.length > 0 ? `${match[1]}%%score ${groups.join(" ")}` : line;
}

export function normalizeAbcVoiceSyntax(abcString: string): string {
  return abcString
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (/^%%score\b/.test(trimmed)) return normalizeAbcScoreLine(line);
      if (/^V:/.test(trimmed)) return normalizeAbcVoiceDeclarationLine(line);
      if (/^\[V:[^\]]+\]/.test(trimmed)) return normalizeAbcInlineVoiceLine(line);
      return line;
    })
    .join("\n");
}

export function findAbcVoiceSyntaxIssues(abcString: string): string[] {
  const issues: string[] = [];

  abcString.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (/^%%score\b/.test(trimmed) && trimmed.includes("]")) {
      issues.push(`Line ${lineNumber}: %%score contains a malformed voice id with a closing bracket.`);
    }

    const voiceDeclaration = trimmed.match(/^V:(\S+)/);
    if (voiceDeclaration && /[\[\]]/.test(voiceDeclaration[1])) {
      issues.push(`Line ${lineNumber}: V: voice id "${voiceDeclaration[1]}" contains bracket characters.`);
    }

    const inlineVoice = trimmed.match(/^\[V:([^\]]+)\]\s*(.*)$/);
    if (inlineVoice && inlineVoice[2].trim().startsWith("]")) {
      issues.push(`Line ${lineNumber}: inline [V:${inlineVoice[1]}] marker has an extra closing bracket before music.`);
    }
  });

  return issues;
}
