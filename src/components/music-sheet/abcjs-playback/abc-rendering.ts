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

export function postProcessBeats(container: HTMLDivElement | null) {
  if (!container) return;

  const staves = Array.from(container.querySelectorAll("g.abcjs-staff"));
  const lyrics = Array.from(container.querySelectorAll("text.abcjs-lyric"));
  const textNodes = container.querySelectorAll("text.abcjs-annotation");

  // Determine if we have beat indicators
  const beats = Array.from(textNodes).filter(node => {
    const val = (node.textContent || "").trim();
    return val === "⬤" || val === "●" || val === "•" || val === "·";
  });

  if (beats.length > 0) {
    container.classList.add("has-beat-indicators");
  } else {
    container.classList.remove("has-beat-indicators");
  }

  // Add lyrics presence classes to the container
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
  for (const node of Array.from(textNodes)) {
    const val = (node.textContent || "").trim();
    if (val === "⬤" || val === "●" || val === "•" || val === "·") {
      if (val === "⬤") {
        node.setAttribute("class", "abcjs-annotation beat-indicator beat-strong");
        node.setAttribute("data-beat", "Strong");
      } else if (val === "●") {
        node.setAttribute("class", "abcjs-annotation beat-indicator beat-medium");
        node.setAttribute("data-beat", "Medium");
      } else if (val === "•" || val === "·") {
        node.setAttribute("class", "abcjs-annotation beat-indicator beat-soft");
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
          targetY = bestStaff.lyricY + 16; // Place 16px below the lyric line
        } else {
          targetY = bestStaff.bottom + 22; // Place 22px below staff bottom if no lyrics
        }
        node.setAttribute("y", String(targetY));
      } else {
        node.setAttribute("y", String(nodeY + 12)); // Fallback shift
      }
    }
  }
}
