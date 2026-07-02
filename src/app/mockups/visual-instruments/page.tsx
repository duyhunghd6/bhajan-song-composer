import { Suspense } from "react";
import type { Metadata } from "next";
import VisualInstrumentsMockupClient from "./VisualInstrumentsMockupClient";

export const metadata: Metadata = {
  title: "Visual Instrument & Hands POC — Bhajan Song Composer",
  description:
    "Standalone mockup for synchronized guitar/piano visualization and animated 2D hand movement during Music Sheet playback.",
};

export default function VisualInstrumentsPage() {
  return (
    <Suspense fallback={null}>
      <VisualInstrumentsMockupClient />
    </Suspense>
  );
}
