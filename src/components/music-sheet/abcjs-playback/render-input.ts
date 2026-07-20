import {
  ensureGuitarStringForcing,
  prepareGuitarStringForcingForAbcjs,
  stripGuitarStringForcing,
} from "@/lib/theory/guitar-string-forcing";
import type { AbcjsType } from "./types";

interface PrepareAbcjsRenderInputOptions {
  abcString: string;
  overrideKey?: string;
  overrideMeter?: string;
  hideVoiceNames?: boolean;
  tablatureEnabled?: boolean;
}

function isMusicLine(line: string): boolean {
  const trimmed = line.trimStart();
  return !trimmed.startsWith("%") && !/^[A-Z]:/.test(trimmed) && !trimmed.startsWith("w:");
}

function containsGracePitch(content: string): boolean {
  return /\/?[_^=]{0,2}[A-Ga-g][,']*/.test(content);
}

/**
 * ABCJS tablature assumes every closed grace group produced at least one grace
 * note. Discard inert groups such as `{}` and `{~}` at the render boundary,
 * while leaving valid and incomplete source notation untouched for abcjs to
 * report normally.
 */
function stripInertGraceGroups(line: string): string {
  if (!isMusicLine(line) || !line.includes("{")) return line;

  let result = "";
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      inQuote = !inQuote;
      result += character;
      continue;
    }
    if (!inQuote && character === "%") {
      result += line.slice(index);
      break;
    }
    if (!inQuote && character === "{") {
      const closingIndex = line.indexOf("}", index + 1);
      if (closingIndex !== -1) {
        const content = line.slice(index + 1, closingIndex);
        if (!containsGracePitch(content)) {
          index = closingIndex;
          continue;
        }
      }
    }
    result += character;
  }

  return result;
}

function sanitizeInertGraceGroupsForAbcjs(abc: string): string {
  return abc.split("\n").map(stripInertGraceGroups).join("\n");
}

/**
 * Build the exact ABC string passed to the abcjs render boundary.
 */
export function prepareAbcjsRenderInput({
  abcString,
  overrideKey = "",
  overrideMeter = "",
  hideVoiceNames = false,
  tablatureEnabled = false,
}: PrepareAbcjsRenderInputOptions): string {
  let result = abcString;

  if (overrideKey) result = result.replace(/^\s*K:\s*(.+)$/m, `K: ${overrideKey}`);
  if (overrideMeter) result = result.replace(/^\s*M:\s*(.+)$/m, `M: ${overrideMeter}`);

  if (hideVoiceNames) {
    result = result
      .split("\n")
      .map((line) => {
        if (line.trim().startsWith("V:")) {
          return line
            .replace(/name="[^"]*"/g, "")
            .replace(/name=[^\s]+/g, "")
            .replace(/snm="[^"]*"/g, "")
            .replace(/snm=[^\s]+/g, "");
        }
        return line;
      })
      .join("\n");
  }

  result = sanitizeInertGraceGroupsForAbcjs(result);

  return tablatureEnabled
    ? prepareGuitarStringForcingForAbcjs(ensureGuitarStringForcing(result))
    : stripGuitarStringForcing(result);
}

export function renderPreparedAbc(
  abcjs: Pick<AbcjsType, "renderAbc">,
  target: string | HTMLElement,
  preparedAbc: string,
  options?: Record<string, unknown>,
) {
  return abcjs.renderAbc(target, preparedAbc, options);
}
