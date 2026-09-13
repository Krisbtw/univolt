/**
 * fusionStore.ts — Session-only Zustand store for the fusion engine inputs.
 * No persistence: data lives only for the current browser session.
 */
import { create } from "zustand";
import type { FusionInputs, FusionRppg, FusionSpo2, FusionSymptoms } from "./fusionEngine";

interface FusionSession extends FusionInputs {
  setRppg: (rppg: FusionRppg) => void;
  setSpo2: (value: number | null, quality: FusionSpo2["quality"]) => void;
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
  spo2: undefined,
  crtSec: undefined,
  fetSec: undefined,
};

export const useFusionSession = create<FusionSession>((set) => ({
  ...empty,
  setRppg: (rppg) => set({ rppg }),
  setSpo2: (value, quality) => set({ spo2: { value, quality } }),
  setCrt: (crtSec) => set({ crtSec }),
  setFet: (fetSec) => set({ fetSec }),
  setQuestionnaire: ({ ageYears, pregnant, symptoms }) =>
    set({ ageYears, pregnant, symptoms }),
  reset: () => set(empty),
}));
