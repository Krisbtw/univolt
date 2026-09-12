/**
 * fusionStore.ts — Session-only Zustand store for the fusion engine inputs.
 * No persistence: data lives only for the current browser session.
 */
import { create } from "zustand";
import type { FusionInputs, FusionRppg, FusionSymptoms } from "./fusionEngine";

interface FusionSession extends FusionInputs {
  setRppg: (rppg: FusionRppg) => void;
  setCrt: (crtSec: number | null) => void;
  setFet: (fetSec: number | null) => void;
  setQuestionnaire: (q: {
    ageYears?: number;
    pregnant?: boolean;
    symptoms?: FusionSymptoms;
  }) => void;
  reset: () => void;
}

const empty: FusionInputs = {
  ageYears: undefined,
  pregnant: undefined,
  symptoms: undefined,
  rppg: undefined,
  crtSec: undefined,
  fetSec: undefined,
};

export const useFusionSession = create<FusionSession>((set) => ({
  ...empty,
  setRppg: (rppg) => set({ rppg }),
  setCrt: (crtSec) => set({ crtSec }),
  setFet: (fetSec) => set({ fetSec }),
  setQuestionnaire: ({ ageYears, pregnant, symptoms }) =>
    set({ ageYears, pregnant, symptoms }),
  reset: () => set(empty),
}));
