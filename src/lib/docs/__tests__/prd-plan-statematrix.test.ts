import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const matrixPath = path.join(process.cwd(), "docs", "product", "PRD-to-PLAN-statematrix.md");

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
      "| `br-plan-06` | Visual Instruments & AI UI | `br-prd01-s17`, `br-prd01-s25`, `br-prd01-s36`, `br-prd01-s38`, `br-prd01-s46`, `br-prd01-s53` | 4 | 0 | 0 | 0 | 4 | 100.0% |"
    );
    expect(tableRowFor(matrix, "br-plan-06.c02")).toContain("| Verified |");
    expect(tableRowFor(matrix, "br-plan-06.c02")).toContain("instrument-highlighting.ts");
    expect(tableRowFor(matrix, "br-plan-06.c03")).toContain("| Verified |");
    expect(tableRowFor(matrix, "br-plan-06.c03")).toContain("PianoPedalIndicator.tsx");
    expect(tableRowFor(matrix, "br-plan-06.c04")).toContain("| Verified |");
    expect(tableRowFor(matrix, "br-plan-06.c04")).toContain("TheoryAssistant.tsx");
  });

  it("pins PRD trace coverage counts to the metadata-derived values", () => {
    const matrix = readMatrix();

    expect(matrix).toContain("| All PRD section coverage | `55 covered / 63 PRD IDs` | **87.3%** |");
    expect(matrix).toContain(
      "| Actionable/in-scope PRD coverage | `54 covered / 54 actionable child sections` | **100.0%** |"
    );
    expect(matrix).toContain("| Unlinked non-actionable/context sections | `8 unlinked / 63 PRD IDs` | **12.7%** |");
  });

  it("keeps the aggregate implementation totals synchronized after br-plan-06 closure", () => {
    const matrix = readMatrix();

    expect(tableRowFor(matrix, "**Total**")).toBe(
      "| **Total** | — | — | **79** | **6** | **1** | **23** | **49** | **91.1%** |"
    );
  });
});
