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
