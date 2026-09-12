export type Sex = "F" | "M" | "X";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";

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
  // ── Emergency card medical fields (all optional) ──────────────────────
  /** Blood group, e.g. "O+". Stored but never transmitted with identifying data. */
  bloodGroup?: BloodGroup;
  /** Free-text allergies list. */
  allergies?: string;
  /** Chronic conditions, e.g. "Hypertension, Diabetes". */
  conditions?: string;
  /** Current medication, free text. */
  currentMedication?: string;
  // ── Communication Assistance (accessibility layer) ─────────────────────
  /** Can the patient speak? Undefined means true (existing records default to able). */
  canSpeak?: boolean;
  /** Can the patient hear? Undefined means true (existing records default to able). */
  canHear?: boolean;
  /** Can the patient read? Undefined means true (existing records default to able). */
  canRead?: boolean;
};

/** Resolved communication profile with defaults applied (missing → able). */
export type CommunicationProfile = {
  canSpeak: boolean;
  canHear: boolean;
  canRead: boolean;
};

export type VitalsScan = {
  id: string;
  patientId: string;
  capturedAt: number;
  heartRate: number;
  hrvRmssd: number;
  signalQuality: number;
  respiratoryRate: number;
  /**
   * SpO₂ estimate from the camera rPPG pipeline (simulated / unreliable).
   * For the honest SpO₂ display we only show MANUAL readings.
   */
  spo2Estimate: number;
  peakCount: number;
  durationSec: number;
  simulated: boolean;
  syncStatus: SyncStatus;
  /**
   * "scan"   = saved by the camera rPPG pipeline (default for existing records).
   * "manual" = manually entered pulse-oximeter SpO₂ point.
   */
  source?: "scan" | "manual";
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
