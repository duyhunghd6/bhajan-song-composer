export function extractRenderedTabFromSvg(containerId: string): string {
  if (typeof document === "undefined") return "Not in browser";
  const container = document.getElementById(containerId);
  if (!container) return "Container not found";
  const svg = container.querySelector('svg');
  if (!svg) return "SVG not found";

  const tabElements = Array.from(svg.querySelectorAll('.abcjs-tab-number'));
  if (tabElements.length === 0) return "No tablature rendered on screen";

  const yMap = new Map<number, Element[]>();
  for (const el of tabElements) {
    const y = parseFloat(el.getAttribute('y') || "0");
    const roundedY = Math.round(y); 
    let foundY = roundedY;
    for (const existingY of yMap.keys()) {
      if (Math.abs(existingY - roundedY) <= 2) {
        foundY = existingY;
        break;
      }
    }
    if (!yMap.has(foundY)) yMap.set(foundY, []);
    yMap.get(foundY)!.push(el);
  }

  const sortedYs = Array.from(yMap.keys()).sort((a, b) => a - b);

  const allXs = new Set<number>();
  for (const el of tabElements) {
    allXs.add(Math.round(parseFloat(el.getAttribute('x') || "0") / 5) * 5);
  }
  const sortedXs = Array.from(allXs).sort((a, b) => a - b);

  const lines: string[] = [];
  
  for (let i = 0; i < sortedYs.length; i++) {
    const stringNum = i + 1;
    const y = sortedYs[i];
    const elementsOnString = yMap.get(y)!;
    
    let lineStr = `String ${stringNum}: `;
    for (const x of sortedXs) {
      const el = elementsOnString.find(t => {
        const textX = Math.round(parseFloat(t.getAttribute('x') || "0") / 5) * 5;
        return textX === x;
      });
      
      if (el && el.textContent) {
        lineStr += el.textContent.padEnd(4, "-");
      } else {
        lineStr += "----";
      }
    }
    lines.push(lineStr);
  }

  return lines.join("\n");
}
