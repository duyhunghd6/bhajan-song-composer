import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const matrixPath = path.join(process.cwd(), "docs", "PRD-to-PLAN-statematrix.md");

function readMatrix() {
  return readFileSync(matrixPath, "utf8");
}

function tableRowFor(markdown: string, id: string) {
  const rowPrefix = id.startsWith("**") ? `| ${id} |` : `| \`${id}\` |`;
  const row = markdown
    .split("\n")
    .find((line) => line.startsWith(rowPrefix));

  if (!row) {
    throw new Error(`Missing state matrix row for ${id}`);
  }

  return row;
}

describe("PRD-to-PLAN state matrix trace closure", () => {
  it("records br-plan-06 visual instruments and AI UI as fully implemented", () => {
    const matrix = readMatrix();

    expect(tableRowFor(matrix, "br-plan-06")).toBe(
      "| `br-plan-06` | Visual Instruments & AI UI | `prd-bsc-s17`, `prd-bsc-s25`, `prd-bsc-s36`, `prd-bsc-s38`, `prd-bsc-s46`, `prd-bsc-s53` | 4 | 0 | 0 | 4 | 0 | 100.0% |"
    );
    expect(tableRowFor(matrix, "br-plan-06.c02")).toContain("| Implemented |");
    expect(tableRowFor(matrix, "br-plan-06.c02")).toContain("instrument-highlighting.ts");
    expect(tableRowFor(matrix, "br-plan-06.c03")).toContain("| Implemented |");
    expect(tableRowFor(matrix, "br-plan-06.c03")).toContain("PianoPedalIndicator.tsx");
    expect(tableRowFor(matrix, "br-plan-06.c04")).toContain("| Implemented |");
    expect(tableRowFor(matrix, "br-plan-06.c04")).toContain("TheoryAssistant.tsx");
  });

  it("keeps the aggregate implementation totals synchronized after br-plan-06 closure", () => {
    const matrix = readMatrix();

    expect(tableRowFor(matrix, "**Total**")).toBe(
      "| **Total** | — | — | **59** | **22** | **5** | **32** | **0** | **54.2%** |"
    );
  });
});
