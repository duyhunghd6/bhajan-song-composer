import { StreamLanguage, type StringStream } from "@codemirror/language";

/**
 * Lightweight ABC 2.1 tokenizer for editor highlighting only. It never decides
 * musical meaning; abcjs and the theory modules own parsing.
 */
type LineKind = "header" | "lyrics" | "music";

interface AbcTokenState {
  line: LineKind;
}

const BAR_LINE = /^(?::*\|\]|\|\||\[\||:*\|:*|::)(?:\[?\d[\d,-]*)?|^\[\d[\d,-]*/;
const NOTE = /^[\^=_]*[A-Ga-g][,']*\d*\/*\d*/;
const REST = /^[zZxy]\d*\/*\d*/;

function tokenMusic(stream: StringStream): string | null {
  if (stream.match(/^%.*/)) return "comment";
  if (stream.match(/^"[^"]*"?/)) return "string";
  if (stream.match(/^![^!\s]*!?/) || stream.match(/^\+[^+\s]*\+/)) return "macroName";
  if (stream.match(/^\[[A-Za-z]:[^\]]*\]?/)) return "keyword";
  if (stream.match(BAR_LINE)) return "punctuation";
  if (stream.match(/^\(\d(?::\d*){0,2}/)) return "number";
  if (stream.match(NOTE)) return "variableName";
  if (stream.match(REST)) return "atom";
  if (stream.match(/^[-()[\]{}<>.~]/)) return "operator";
  stream.next();
  return null;
}

function tokenLyrics(stream: StringStream): string | null {
  if (stream.match(/^%.*/)) return "comment";
  if (stream.match(/^[|]/)) return "punctuation";
  if (stream.match(/^[-_*~]/)) return "operator";
  if (stream.match(/^(?:\\-|[^\s|\-_*~%])+/)) return "labelName";
  stream.next();
  return null;
}

export const abcLanguage = StreamLanguage.define<AbcTokenState>({
  name: "abc",
  startState: () => ({ line: "music" }),
  token(stream, state) {
    if (stream.sol()) {
      if (stream.match(/^%%.*/)) return "meta";
      if (stream.match(/^%.*/)) return "comment";
      if (stream.match(/^\s*w:/)) {
        state.line = "lyrics";
        return "keyword";
      }
      if (stream.match(/^[A-Za-z]:/)) {
        state.line = "header";
        return "keyword";
      }
      state.line = "music";
    }
    if (stream.eatSpace()) return null;
    if (state.line === "header") {
      if (stream.match(/^%.*/)) return "comment";
      stream.match(/^[^%]+/);
      return "literal";
    }
    return state.line === "lyrics" ? tokenLyrics(stream) : tokenMusic(stream);
  },
  languageData: { commentTokens: { line: "%" } },
});
