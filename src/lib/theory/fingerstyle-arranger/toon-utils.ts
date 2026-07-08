import { type TimeSliceMeasure, type TimeSliceGridStep } from "./time-slice";

export function formatMeasureAsToon(measure: TimeSliceMeasure): string {
  let toon = `measure: ${measure.measure}\n`;
  toon += `style_profile:\n`;
  toon += `  key: ${measure.style_profile.key || "null"}\n`;
  toon += `  comping_style: "${measure.style_profile.comping_style || "null"}"\n`;
  toon += `  voicing_plan: "${measure.style_profile.voicing_plan || "null"}"\n`;
  
  toon += `grid: [${measure.grid.length}]\n`;
  toon += `{step, chord, weight, melody.pitch, melody.state, lyric, tablature}\n`;
  
  for (const step of measure.grid) {
    const s = step.step;
    const c = step.chord ? `"${step.chord}"` : "null";
    const w = step.weight ? `"${step.weight}"` : "null";
    const mp = step.melody?.pitch ? `"${step.melody.pitch}"` : "null";
    const ms = step.melody?.state ? `"${step.melody.state}"` : "null";
    const l = step.lyric ? `"${step.lyric}"` : "null";
    const t = step.tablature && step.tablature.length > 0 ? JSON.stringify(step.tablature) : "[]";
    toon += `${s}, ${c}, ${w}, ${mp}, ${ms}, ${l}, ${t}\n`;
  }
  return toon;
}

export function renderAsciiTab(grid: TimeSliceGridStep[]): string {
  const strings = {
    1: { name: "e", track: new Array(grid.length).fill("--") },
    2: { name: "B", track: new Array(grid.length).fill("--") },
    3: { name: "G", track: new Array(grid.length).fill("--") },
    4: { name: "D", track: new Array(grid.length).fill("--") },
    5: { name: "A", track: new Array(grid.length).fill("--") },
    6: { name: "E", track: new Array(grid.length).fill("--") },
  };

  for (let i = 0; i < grid.length; i++) {
    const step = grid[i];
    if (step.tablature && step.tablature.length > 0) {
      for (const tab of step.tablature) {
        if (tab.string >= 1 && tab.string <= 6) {
          const fretStr = tab.fret.toString();
          strings[tab.string as 1|2|3|4|5|6].track[i] = fretStr.padEnd(2, "-");
        }
      }
    }
  }

  let output = "## 7. The Final Visual Output\n\n";
  for (let s = 1; s <= 6; s++) {
    const stringNum = s as 1|2|3|4|5|6;
    output += `${strings[stringNum].name}|-${strings[stringNum].track.join("-")}-|\n`;
  }
  return output;
}

function parseToonValue(val: string): string | null | undefined {
  val = val.trim();
  if (val === "null") return null;
  if (val === "undefined") return undefined;
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  return val;
}

function splitToonLine(line: string, maxParts: number): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let inBrackets = 0;
  let inBraces = 0;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && line[i - 1] !== '\\') inQuotes = !inQuotes;
    else if (char === '[') inBrackets++;
    else if (char === ']') inBrackets--;
    else if (char === '{') inBraces++;
    else if (char === '}') inBraces--;

    if (char === ',' && !inQuotes && inBrackets === 0 && inBraces === 0) {
      if (parts.length < maxParts - 1) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }
    
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

export function parseToonToMeasure(toon: string, originalMeasure: TimeSliceMeasure): TimeSliceMeasure {
  const lines = toon.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const gridStart = lines.findIndex(l => l.startsWith("{step"));
  if (gridStart === -1) throw new Error("Invalid TOON format: Missing '{step...' grid header line");

  const newGrid: TimeSliceGridStep[] = [];
  
  for (let i = gridStart + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const parts = splitToonLine(line, 7);
    if (parts.length < 7) continue; // Skip malformed rows

    const s = parseInt(parts[0], 10);
    const c = parseToonValue(parts[1]) ?? "";
    const w = (parseToonValue(parts[2]) as "⬤" | "●" | "*" | null) ?? null;
    const mp = parseToonValue(parts[3]) ?? null;
    const ms = (parseToonValue(parts[4]) as "attack" | "sustain" | "rest") ?? "rest";
    const l = parseToonValue(parts[5]) ?? null;
    
    let t = [];
    try {
      t = JSON.parse(parts.slice(6).join(",").trim());
    } catch (e) {
      throw new Error(`Failed to parse tablature JSON at step ${s}: ${e}`);
    }

    newGrid.push({
      step: s,
      chord: c,
      weight: w,
      melody: { pitch: mp, state: ms },
      lyric: l,
      tablature: t
    });
  }

  return { ...originalMeasure, grid: newGrid };
}
