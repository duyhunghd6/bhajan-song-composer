import { useState, useEffect, useCallback } from "react";
import type { HarmonizationOption } from "@/lib/theory/harmonization-candidates";
import type { AccompanimentOption } from "@/lib/theory/accompaniment-candidates";
import type { PianoAccompaniment } from "@/lib/theory/piano-accompaniment";
import type { FingerstyleComposerIntegration } from "./fingerstyle-integration";
import type { TheoryAssistantLayerProposal } from "./theory-assistant-layer";
import type { AccompanimentWorkflowSession, AccompanimentWorkflowSetup } from "@/lib/theory/accompaniment-workflow";
import type { EnsembleWorkflowSession } from "@/lib/theory/ensemble-workflow";
import type { EnsembleExpansionValidation } from "@/lib/theory/ensemble-output-contract";
import type { EnsembleConflictReportEntry } from "@/lib/theory/ensemble-conflicts";
import { getComposerWorkspaceStorageKey } from "./workspace/storage";

export const DEFAULT_HARMONY_LAYER_VISIBILITY: Record<string, boolean> = {
  ChordProgression: true,
  Lyrics: true,
  Melody: true,
  TAB: false,
};

export const DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY: Record<string, boolean> = {
  ChordProgression: true,
  Lyrics: true,
  StrongBeats: true,
  Melody: true,
  TAB: false,
};

export const DEFAULT_LAYER_VOLUMES: Record<string, number> = {
  ChordProgression: 100,
  Melody: 100,
};

export interface EnsembleLayerAbcBundle {
  djembe: string | null;
  flute: string | null;
  violin: string | null;
  combined: string | null;
  sourceFingerprint: string;
  selectionFingerprint: string;
  appliedAt: string | null;
  validation?: EnsembleExpansionValidation;
  conflictReport?: EnsembleConflictReportEntry[];
}

export interface WorkspaceState {
  aiSuggestions: HarmonizationOption[];
  selectedCandidateId: string | null;
  acceptedHarmony: TheoryAssistantLayerProposal | null;
  aiAccompanimentSuggestions: AccompanimentOption[];
  selectedAccompanimentIndex: number | null;
  pianoAccompanimentData: PianoAccompaniment | null;
  guitarAccompanimentData: FingerstyleComposerIntegration | null;
  generatedAccompaniment: string | null;
  // Separate Guitar / Piano AI generation
  aiGuitarSuggestions: AccompanimentOption[];
  aiPianoSuggestions: AccompanimentOption[];
  selectedGuitarIndex: number | null;
  selectedPianoIndex: number | null;
  generatedGuitar: string | null;
  generatedPiano: string | null;
  accompanimentWorkflowSetup: AccompanimentWorkflowSetup | null;
  accompanimentWorkflow: AccompanimentWorkflowSession | null;
  ensembleWorkflow: EnsembleWorkflowSession | null;
  stagedEnsembleLayers: EnsembleLayerAbcBundle | null;
  appliedEnsembleLayers: EnsembleLayerAbcBundle | null;
  accompanimentLayerVisibility: Record<string, boolean>;
  accompanimentLayerVolumes: Record<string, number>;
}

export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  aiSuggestions: [],
  selectedCandidateId: null,
  acceptedHarmony: null,
  aiAccompanimentSuggestions: [],
  selectedAccompanimentIndex: null,
  pianoAccompanimentData: null,
  guitarAccompanimentData: null,
  generatedAccompaniment: null,
  // Separate Guitar / Piano AI generation
  aiGuitarSuggestions: [],
  aiPianoSuggestions: [],
  selectedGuitarIndex: null,
  selectedPianoIndex: null,
  generatedGuitar: null,
  generatedPiano: null,
  accompanimentWorkflowSetup: null,
  accompanimentWorkflow: null,
  ensembleWorkflow: null,
  stagedEnsembleLayers: null,
  appliedEnsembleLayers: null,
  accompanimentLayerVisibility: DEFAULT_ACCOMPANIMENT_LAYER_VISIBILITY,
  accompanimentLayerVolumes: DEFAULT_LAYER_VOLUMES,
};

export function useWorkspaceState(slug: string) {
  const storageKey = getComposerWorkspaceStorageKey(slug);

  const [state, setState] = useState<WorkspaceState>(DEFAULT_WORKSPACE_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- workspace state must hydrate from localStorage after mount to avoid SSR/localStorage mismatches.
        setState({
          ...DEFAULT_WORKSPACE_STATE,
          ...parsed,
        });
      }
    } catch (e) {
      console.error("Failed to load workspace state", e);
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  // Save to local storage whenever state changes, but ONLY if hydrated.
  // The fully reset state removes the per-song workspace key instead of keeping
  // an inert JSON copy that can later rehydrate stale ABC-affecting choices.
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (state === DEFAULT_WORKSPACE_STATE) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      }
    } catch (e) {
      console.error("Failed to save workspace state", e);
    }
  }, [state, isHydrated, storageKey]);

  const updateState = useCallback((updates: Partial<WorkspaceState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setState(DEFAULT_WORKSPACE_STATE);
  }, []);

  return {
    state,
    updateState,
    resetState,
    isHydrated,
  };
}
