/**
 * Parse the Q: (tempo) field from an ABC notation string.
 * Supports formats like "Q: 1/4=65", "Q:120", "Q: 65".
 * Returns the BPM number or the provided default if not found.
 */
export function parseAbcTempo(abcString: string, defaultBpm = 120): number {
  const match = abcString.match(/^\s*Q:\s*(?:\d+\/\d+=)?(\d+)/m);
  if (match) {
    const bpm = parseInt(match[1], 10);
    if (bpm > 0 && bpm <= 600) return bpm;
  }
  return defaultBpm;
}

function beatIndicatorWeight(value: string): number {
  if (value === "⬤") return 3;
  if (value === "●") return 2;
  if (value === "•" || value === "·") return 1;
  return 0;
}

function isBeatIndicatorNode(node: Element): boolean {
  // Disable beat indicator processing so they render as normal lyrics text.
  return false;
}

function beatIndicatorDedupeKey(node: Element): string {
  const className = node.getAttribute("class") || "";
  const line = className.match(/\babcjs-l\d+\b/)?.[0] ?? "line";
  const measure = className.match(/\babcjs-m\d+\b/)?.[0] ?? className.match(/\babcjs-mm\d+\b/)?.[0] ?? "measure";
  const voice = className.match(/\babcjs-v\d+\b/)?.[0] ?? "voice";
  const x = Math.round(parseFloat(node.getAttribute("x") || "0"));
  return `${line}:${measure}:${voice}:${x}`;
}

function dedupeBeatIndicatorNodes(nodes: Element[]): Element[] {
  const chosen = new Map<string, Element>();
  const duplicates: Element[] = [];

  for (const node of nodes) {
    const key = beatIndicatorDedupeKey(node);
    const current = chosen.get(key);
    if (!current) {
      chosen.set(key, node);
      continue;
    }

    const nodeWeight = beatIndicatorWeight((node.textContent || "").trim());
    const currentWeight = beatIndicatorWeight((current.textContent || "").trim());
    if (nodeWeight > currentWeight) {
      duplicates.push(current);
      chosen.set(key, node);
    } else {
      duplicates.push(node);
    }
  }

  duplicates.forEach((node) => node.remove());
  return [...chosen.values()];
}

export function postProcessBeats(container: HTMLDivElement | null) {
  if (!container) return;
  const staves = Array.from(container.querySelectorAll("g.abcjs-staff"));
  const allLyrics = Array.from(container.querySelectorAll("text.abcjs-lyric"));
  const beatLyricNodes = allLyrics.filter(isBeatIndicatorNode);
  const lyrics = allLyrics.filter((node) => {
    const text = (node.textContent || "").trim();
    return text.length > 0 && !isBeatIndicatorNode(node);
  });

  // Determine if we have beat indicators, and collapse duplicate markers rendered at the same note position.
  const beats = dedupeBeatIndicatorNodes(beatLyricNodes);

  if (beats.length > 0) {
    container.classList.add("has-beat-indicators");
  } else {
    container.classList.remove("has-beat-indicators");
  }

  // Add lyrics presence classes to the container. Beat-only w: rows are not treated as user lyrics.
  if (lyrics.length > 0) {
    container.classList.add("has-lyrics");
    container.classList.remove("no-lyrics");
  } else {
    container.classList.add("no-lyrics");
    container.classList.remove("has-lyrics");
  }

  // Identify tablature staves by finding the closest g.abcjs-staff to the TAB clef symbol
  const tabPaths = Array.from(container.querySelectorAll('path[data-name="tab.big"]'));
  tabPaths.forEach((path) => {
    try {
      const pathBox = (path as unknown as SVGGraphicsElement).getBBox();
      const pathY = pathBox.y + pathBox.height / 2;

      let closestStaff: Element | null = null;
      let minDistance = Infinity;

      staves.forEach((staff) => {
        try {
          const staffBox = (staff as unknown as SVGGraphicsElement).getBBox();
          const staffY = staffBox.y + staffBox.height / 2;
          const dist = Math.abs(staffY - pathY);
          if (dist < minDistance) {
            minDistance = dist;
            closestStaff = staff;
          }
        } catch {
          // ignore
        }
      });

      if (closestStaff) {
        (closestStaff as Element).classList.add("abcjs-tablature-staff");
      }
    } catch {
      // ignore
    }
  });

  interface StaffDataItem {
    element: Element;
    y: number;
    height: number;
    bottom: number;
    lyricY: number | null;
  }

  // 1. Group staves and get their vertical boundaries
  const staffData = (staves
    .map((staff) => {
      try {
        const svgPath = staff as unknown as SVGGraphicsElement;
        const box = svgPath.getBBox();
        return {
          element: staff,
          y: box.y,
          height: box.height,
          bottom: box.y + box.height,
          lyricY: null as number | null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as unknown) as StaffDataItem[];

  // 2. Find the lyric Y coordinate for each staff system
  for (const lyric of lyrics) {
    const lyricY = parseFloat(lyric.getAttribute("y") || "0");
    let bestStaff: StaffDataItem | null = null;
    let minDiff = Infinity;
    for (const sd of staffData) {
      const diff = lyricY - sd.bottom;
      if (diff > 0 && diff < 150 && diff < minDiff) {
        minDiff = diff;
        bestStaff = sd;
      }
    }
    if (bestStaff) {
      if (bestStaff.lyricY === null || lyricY > bestStaff.lyricY) {
        bestStaff.lyricY = lyricY;
      }
    }
  }

  // 3. Position and style the beat indicators below lyrics
  for (const node of beats) {
    const val = (node.textContent || "").trim();
    node.classList.add("beat-indicator");
    node.setAttribute("aria-hidden", "true");

    if (val === "⬤") {
      node.classList.add("beat-strong");
      node.setAttribute("data-beat", "Strong");
    } else if (val === "●") {
      node.classList.add("beat-medium");
      node.setAttribute("data-beat", "Medium");
    } else if (val === "•" || val === "·") {
      node.classList.add("beat-soft");
      node.setAttribute("data-beat", "Soft");
      node.textContent = "●"; // Normalize to standard filled circle
    }

    const nodeY = parseFloat(node.getAttribute("y") || "0");

    // Find the corresponding staff system
    let bestStaff: StaffDataItem | null = null;
    let minStaffDist = Infinity;

    for (const sd of staffData) {
      const dist = Math.abs(sd.y + sd.height / 2 - nodeY);
      if (dist < minStaffDist) {
        minStaffDist = dist;
        bestStaff = sd;
      }
    }

    if (bestStaff) {
      let targetY;
      if (bestStaff.lyricY !== null && bestStaff.lyricY > 0) {
        targetY = bestStaff.lyricY + 16; // Place 16px below the real lyric line
      } else {
        targetY = bestStaff.bottom + 22; // Place 22px below staff bottom if no real lyrics
      }
      node.setAttribute("y", String(targetY));
    } else {
      node.setAttribute("y", String(nodeY + 12)); // Fallback shift
    }
  }
}

/**
 * Post-process chord symbol positions to prevent overlap with tablature staves.
 *
 * ABCJS positions chord text (`text.abcjs-chord`) based on the note's pitch
 * within the standard staff. For low-pitched guitar notes this places the chord
 * text directly on top of the TAB staff lines below. This function detects
 * chords that belong to a staff system with an adjacent tablature staff and
 * repositions them above the standard notation staff.
 *
 * Must be called AFTER `postProcessBeats` because that function tags staves
 * with the `.abcjs-tablature-staff` class that we rely on here.
 */
export function postProcessChords(container: HTMLDivElement | null) {
  if (!container) return;

  const chords = Array.from(container.querySelectorAll("text.abcjs-chord"));
  if (chords.length === 0) return;

  const staves = Array.from(container.querySelectorAll("g.abcjs-staff"));
  if (staves.length === 0) return;

  // Build staff data with bounding boxes and tablature classification
  interface ChordStaffData {
    element: Element;
    y: number;
    height: number;
    bottom: number;
    isTab: boolean;
  }

  const staffData: ChordStaffData[] = [];
  for (const staff of staves) {
    try {
      const box = (staff as unknown as SVGGraphicsElement).getBBox();
      staffData.push({
        element: staff,
        y: box.y,
        height: box.height,
        bottom: box.y + box.height,
        isTab: staff.classList.contains("abcjs-tablature-staff"),
      });
    } catch {
      // ignore
    }
  }

  if (staffData.length === 0) return;

  // Sort staves by vertical position (top to bottom)
  staffData.sort((a, b) => a.y - b.y);

  // Identify which non-tab staves have a tablature staff directly below them.
  // In a typical multi-voice layout: [Melody staff] [Guitar staff] [TAB staff]
  // The "Guitar staff" (non-tab) is the one whose chords need repositioning.
  const tabAdjacentStaves = new Set<ChordStaffData>();
  for (let i = 0; i < staffData.length; i++) {
    const current = staffData[i];
    if (current.isTab) continue;

    // Look for a TAB staff below this one within the same staff system
    // (reasonable vertical proximity — within 200px)
    for (let j = i + 1; j < staffData.length; j++) {
      const candidate = staffData[j];
      if (candidate.y - current.bottom > 200) break; // too far away
      if (candidate.isTab) {
        tabAdjacentStaves.add(current);
        break;
      }
    }
  }

  if (tabAdjacentStaves.size === 0) return;

  // Clearance above the staff's top line for chord text
  const CHORD_CLEARANCE_PX = 40;

  for (const chord of chords) {
    const chordY = parseFloat(chord.getAttribute("y") || "0");

    // Find the non-tab staff this chord is closest to
    let bestStaff: ChordStaffData | null = null;
    let minDist = Infinity;

    for (const sd of staffData) {
      if (sd.isTab) continue;
      // Chord should be vertically within or near this staff
      const dist = Math.abs(sd.y + sd.height / 2 - chordY);
      if (dist < minDist) {
        minDist = dist;
        bestStaff = sd;
      }
    }

    if (!bestStaff) continue;

    // Only reposition chords that belong to a staff with TAB below it
    if (!tabAdjacentStaves.has(bestStaff)) continue;

    // Move the chord above the standard staff's top line
    const targetY = bestStaff.y - CHORD_CLEARANCE_PX;
    chord.setAttribute("y", String(targetY));
  }
}
