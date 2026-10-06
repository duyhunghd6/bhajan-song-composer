import abcjs from 'abcjs';

interface NoteElement { startChar?: number; pitches?: { name: string }[]; strummingPitchOrder?: string[] }
interface Tune { lines?: { staff?: { voices?: NoteElement[][] }[] }[] }
function elements(tune: Tune): NoteElement[] {
  return tune.lines?.flatMap(line => line.staff?.flatMap(staff => staff.voices?.flat() ?? []) ?? []) ?? [];
}

/** Engraving sorts pitches in place. Retain written string order separately for audio. */
export function retainWrittenStrummingOrder(preparedAbc: string, rendered: unknown[]) {
  if (!/^V:GuitarStrumming\b/m.test(preparedAbc)) return;
  const parsed = abcjs.parseOnly(preparedAbc) as unknown as Tune[];
  rendered.forEach((tune, index) => {
    const order = new Map(elements(parsed[index] ?? {}).filter(e => e.pitches).map(e => [e.startChar, e.pitches!.map(p => p.name)]));
    for (const element of elements(tune as Tune)) {
      if (element.pitches) element.strummingPitchOrder = order.get(element.startChar);
    }
  });
}
