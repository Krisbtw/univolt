export type Sex = "F" | "M" | "X";

export type SyncStatus = "local" | "queued" | "synced";

export type CoughClassification =
  | "Normal"
  | "Possible irregular breathing pattern — refer for clinical follow-up";

export type Patient = {
  id: string;
  caseId: string;
  name: string;
  age: number;
  sex: Sex;
  village: string;
  createdAt: number;
  lastVisitAt: number;
};

export type VitalsScan = {
  id: string;
  patientId: string;
  capturedAt: number;
  heartRate: number;
  hrvRmssd: number;
  signalQuality: number;
  respiratoryRate: number;
  spo2Estimate: number;
  peakCount: number;
  durationSec: number;
  simulated: boolean;
  syncStatus: SyncStatus;
};

export type CoughScreening = {
  id: string;
  patientId: string;
  capturedAt: number;
  classification: CoughClassification;
  zeroCrossingRate: number;
  energyVariance: number;
  durationSec: number;
  simulated: boolean;
  notes: string;
  syncStatus: SyncStatus;
};

export type UnivoltDb = {
  patients: Patient[];
  scans: VitalsScan[];
  coughs: CoughScreening[];
  meta: {
    seeded: boolean;
    version: number;
  };
};

export type PpgResult = {
  heartRate: number;
  hrvRmssd: number;
  signalQuality: number;
  respiratoryRate: number;
  spo2Estimate: number;
  peakCount: number;
  durationSec: number;
  sampleRate: number;
};

export type CoughResult = {
  classification: CoughClassification;
  zeroCrossingRate: number;
  energyVariance: number;
  durationSec: number;
  simulated: boolean;
  notes: string;
};
