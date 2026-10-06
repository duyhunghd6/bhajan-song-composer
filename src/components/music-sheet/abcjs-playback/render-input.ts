import { retainWrittenStrummingOrder } from "./strumming-pitch-order";
import { extractAbcVoiceIds } from '@/lib/theory/abc-layer-visibility';
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
 * Build the transient ABCJS input: caller ABC → render-only adaptation →
 * `abcjs.renderAbc`. Nothing returned here may be persisted as canonical ABC
 * or reused for portable export; string forcing and sanitization are adapter
 * concerns only.
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

  // abcjs treats header MIDI beat as global and dynamics can override it.
  // Strumming's audio adapter applies these uniform per-voice mixer gains.
  if (/^V:GuitarStrumming\b/m.test(result)) result = result.replace(/^%%MIDI beat (\d+) \1 \1 1[ \t]*$/gm, '% Strumming mixer gain applied during audio preparation');

  // Strumming stores concert pitches. ABCJS lowers treble-8 again unless its
  // parser octave is raised; this adaptation belongs only to the render input.
  result = result.replace(/^(V:GuitarStrumming\b[^\n]*\bclef=treble-8[^\n]*)$/gm,
    line => `${line.replace(/\s+octave=[^\s]+/g, "")} octave=1`);
  // Keep standard bow decorations in canonical ABC, but show familiar guitar
  // arrows. Percussion gets its own mark rather than a misleading downstroke.
  let strummingVoice = false;
  result = result.split("\n").map(line => {
    const voice = line.match(/^(?:V:|\[V:)([^\s\]]+)/);
    if (voice) strummingVoice = voice[1] === "GuitarStrumming";
    if (!strummingVoice || !isMusicLine(line)) return line;
    return line.replace(/"\^X"/g, '"^Dead"')
      .replace(/"\^Slap"/g, '"^X"')
      .replace(/!(?:upbow|downbow)!(?=B)/g, "")
      .replace(/!upbow!/g, '"^↑"')
      .replace(/!downbow!/g, '"^↓"');
  }).join("\n");
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
  const tunes = abcjs.renderAbc(target, preparedAbc, options);
  retainWrittenStrummingOrder(preparedAbc, tunes);
  const voiceIndex = extractAbcVoiceIds(preparedAbc).indexOf("GuitarStrumming");
  const container = typeof target === "string" ? (typeof document === "undefined" ? null : document.getElementById(target)) : target;
  if (voiceIndex >= 0) container?.querySelectorAll(`text.abcjs-annotation.abcjs-v${voiceIndex}`).forEach(node => {
    if (/^(?:[↑↓X]|Dead|PM|Choke|\s)+$/.test(node.textContent?.trim() ?? "")) {
      node.setAttribute("data-strumming-technique", "true");
    }
  });
  return tunes;
}
