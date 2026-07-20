import type { ReactNode } from "react";
import type { HarmonizationOption } from "@/lib/theory/harmonization-candidates";

export interface ComposerNotationPreviewLayoutProps {
  source: ReactNode;
  preview: ReactNode;
}

export const COMPOSER_PREVIEW_RENDER_OPTIONS = {
  staffwidth: 720,
  wrap: {
    minSpacing: 1.7,
    maxSpacing: 2.5,
    preferredMeasuresPerLine: 4,
    lastLineLimit: 0.6,
  },
  paddingright: 32,
};

export const ACCOMPANIMENT_PREVIEW_RENDER_OPTIONS = {
  staffwidth: 900,
  wrap: {
    minSpacing: 1.5,
    maxSpacing: 2.2,
    preferredMeasuresPerLine: 4,
    lastLineLimit: 0.6,
  },
  paddingright: 16,
};

export const COMPOSER_STAFF_PLAYBACK_PROPS = {
  minWidthClassName: "min-w-[520px]",
  sheetViewportClassName: "max-h-[800px] overflow-auto",
  useContainerWidth: true,
  hideVoiceNames: true,
  showExactRenderAbcCopy: true,
};

export const COMPOSER_PREVIEW_PROPS = {
  ...COMPOSER_STAFF_PLAYBACK_PROPS,
  renderOptions: COMPOSER_PREVIEW_RENDER_OPTIONS,
};

export function harmonizationOptionId(option: HarmonizationOption, index: number): string {
  return option.id || `candidate-${index + 1}`;
}

export function harmonizationOptionLabel(option: HarmonizationOption): string {
  return option.label || option.progression_name;
}

export function harmonizationOptionAbc(option: HarmonizationOption): string {
  return option.harmonizedAbc || option.abc;
}

export function formatCandidateConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function ComposerNotationPreviewLayout({ source, preview }: ComposerNotationPreviewLayoutProps) {
  return (
    <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="composer-step-responsive-grid grid gap-0">
        <div className="composer-step-source-panel min-w-0 space-y-5 border-b border-zinc-100 p-5 dark:border-zinc-800 min-[1280px]:border-r min-[1280px]:border-b-0">
          {source}
        </div>
        <div className="min-w-0 space-y-3 p-5">
          {preview}
        </div>
      </div>
    </section>
  );
}
