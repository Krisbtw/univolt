import { create } from "zustand";
import { loadOrSeed, makeId, nextCaseId, newPatientInput, saveDb } from "./database";
import type {
  BloodGroup,
  CommunicationProfile,
  ConsultStatus,
  CoughResult,
  Patient,
  PpgResult,
  Sex,
  Spo2Quality,
  TeleConsultRequest,
  UnivoltDb,
} from "./types";

type UnivoltState = {
  ready: boolean;
  db: UnivoltDb;
  init: () => void;
  addPatient: (input: { name: string; age: number; sex: Sex; village: string }) => Patient;
  addVitalsScan: (patientId: string, result: PpgResult, simulated: boolean) => void;
  addCoughScreening: (patientId: string, result: CoughResult) => void;
  /** Add a manual pulse-oximeter SpO₂ reading for a patient. */
  addManualSpo2: (patientId: string, spo2: number) => void;
  /** Add manual clinic equipment readings (BP, Temperature, SpO₂). */
  addManualVitals: (
    patientId: string,
    input: {
      bpSystolic?: number | null;
      bpDiastolic?: number | null;
      temperatureC?: number | null;
      spo2?: number | null;
    },
  ) => void;
  /** Request a store-and-forward tele-consultation packet for a patient. */
  requestTeleConsult: (
    patientId: string,
    input: {
      triageLevel: TeleConsultRequest["triageLevel"];
      vitals: TeleConsultRequest["vitals"];
      symptoms?: Record<string, boolean | number>;
      reasons: string[];
      notes?: string;
    },
  ) => TeleConsultRequest;
  /** Update the status or clinician notes of a tele-consult request. */
  updateConsultStatus: (consultId: string, status: ConsultStatus, note?: string) => void;
  /** Import a complete clinic backup JSON, replacing local database state. */
  importDb: (imported: UnivoltDb) => { success: boolean; count: number };
  /** Record a fingertip camera torch SpO₂ scan. */
  addFingerSpo2: (patientId: string, spo2: number, quality: Spo2Quality) => void;
  /** Attach a camera SpO₂ result to the patient's latest face scan. */
  updateLatestVitalsSpo2: (patientId: string, spo2: number | null, quality: Spo2Quality) => void;
  /** Update optional emergency card medical fields for a patient. */
  updatePatientMedical: (patientId: string, fields: {
    bloodGroup?: BloodGroup;
    allergies?: string;
    conditions?: string;
    currentMedication?: string;
  }) => void;
  /** Mark all 'local' scan and cough records as 'synced' (simulated mesh sync). */
  syncAllRecords: () => void;
  /** Update the Communication Assistance profile (canSpeak / canHear / canRead) for a patient. */
  updateCommunicationProfile: (patientId: string, fields: Partial<CommunicationProfile>) => void;
};

function touchVisit(db: UnivoltDb, patientId: string, at: number): UnivoltDb {
  return {
    ...db,
    patients: db.patients.map((p) => (p.id === patientId ? { ...p, lastVisitAt: at } : p)),
  };
}

export const useUnivolt = create<UnivoltState>((set, get) => ({
  ready: false,
  db: {
    patients: [],
    scans: [],
    coughs: [],
    consults: [],
    meta: { seeded: false, version: 1 },
  },
  init: () => {
    if (get().ready) return;
    const db = loadOrSeed();
    set({ db, ready: true });
  },
  addPatient: (input) => {
    const db = get().db;
    const patient = newPatientInput({
      ...input,
      caseId: nextCaseId(db.patients),
    });
    const next = { ...db, patients: [patient, ...db.patients] };
    saveDb(next);
    set({ db: next });
    return patient;
  },
  addVitalsScan: (patientId, result, simulated) => {
    const at = Date.now();
    const row = {
      id: makeId("s"),
      patientId,
      capturedAt: at,
      heartRate: result.heartRate,
      hrvRmssd: result.hrvRmssd,
      signalQuality: result.signalQuality,
      respiratoryRate: result.respiratoryRate,
      spo2Estimate: result.spo2Estimate,
      spo2Quality: result.spo2Quality,
      peakCount: result.peakCount,
      durationSec: result.durationSec,
      simulated,
      syncStatus: "local" as const,
      source: "scan" as const,
    };
    const db = touchVisit(get().db, patientId, at);
    const next = { ...db, scans: [...db.scans, row] };
    saveDb(next);
    set({ db: next });
  },
  addCoughScreening: (patientId, result) => {
    const at = Date.now();
    const row = {
      id: makeId("c"),
      patientId,
      capturedAt: at,
      classification: result.classification,
      zeroCrossingRate: result.zeroCrossingRate,
      energyVariance: result.energyVariance,
      durationSec: result.durationSec,
      simulated: result.simulated,
      notes: result.notes,
      syncStatus: "local" as const,
    };
    const db = touchVisit(get().db, patientId, at);
    const next = { ...db, coughs: [...db.coughs, row] };
    saveDb(next);
    set({ db: next });
  },
  addManualSpo2: (patientId, spo2) => {
    const at = Date.now();
    const row = {
      id: makeId("m"),
      patientId,
      capturedAt: at,
      heartRate: 0,
      hrvRmssd: 0,
      signalQuality: 0,
      respiratoryRate: 0,
      spo2Estimate: Math.round(spo2),
      spo2Quality: "manual" as const,
      peakCount: 0,
      durationSec: 0,
      simulated: false,
      syncStatus: "local" as const,
      source: "manual" as const,
    };
    const db = touchVisit(get().db, patientId, at);
    const next = { ...db, scans: [...db.scans, row] };
    saveDb(next);
    set({ db: next });
  },
  addFingerSpo2: (patientId, spo2, quality) => {
    const at = Date.now();
    const row = {
      id: makeId("f"),
      patientId,
      capturedAt: at,
      heartRate: 0,
      hrvRmssd: 0,
      signalQuality: quality === "good" ? 80 : 50,
      respiratoryRate: 0,
      spo2Estimate: Math.round(spo2),
      spo2Quality: quality,
      peakCount: 0,
      durationSec: 20,
      simulated: false,
      syncStatus: "local" as const,
      source: "finger" as const,
    };
    const db = touchVisit(get().db, patientId, at);
    const next = { ...db, scans: [...db.scans, row] };
    saveDb(next);
    set({ db: next });
  },
  addManualVitals: (patientId, input) => {
    const at = Date.now();
    const row = {
      id: makeId("m"),
      patientId,
      capturedAt: at,
      heartRate: 0,
      hrvRmssd: 0,
      signalQuality: 0,
      respiratoryRate: 0,
      spo2Estimate: input.spo2 != null ? Math.round(input.spo2) : null,
      spo2Quality: input.spo2 != null ? ("manual" as const) : undefined,
      bpSystolic: input.bpSystolic != null ? Math.round(input.bpSystolic) : null,
      bpDiastolic: input.bpDiastolic != null ? Math.round(input.bpDiastolic) : null,
      temperatureC: input.temperatureC != null ? Number(input.temperatureC.toFixed(1)) : null,
      peakCount: 0,
      durationSec: 0,
      simulated: false,
      syncStatus: "local" as const,
      source: "manual" as const,
    };
    const db = touchVisit(get().db, patientId, at);
    const next = { ...db, scans: [...db.scans, row] };
    saveDb(next);
    set({ db: next });
  },
  requestTeleConsult: (patientId, input) => {
    const at = Date.now();
    const req: TeleConsultRequest = {
      id: makeId("tc"),
      patientId,
      createdAt: at,
      updatedAt: at,
      triageLevel: input.triageLevel,
      vitals: input.vitals,
      symptoms: input.symptoms,
      reasons: input.reasons,
      status: "requested",
      notes: input.notes ?? "",
    };
    const db = touchVisit(get().db, patientId, at);
    const next = { ...db, consults: [req, ...(db.consults ?? [])] };
    saveDb(next);
    set({ db: next });
    return req;
  },
  updateConsultStatus: (consultId, status, note) => {
    const db = get().db;
    const now = Date.now();
    const next = {
      ...db,
      consults: (db.consults ?? []).map((c) =>
        c.id === consultId
          ? {
              ...c,
              status,
              notes: note !== undefined ? note : c.notes,
              updatedAt: now,
            }
          : c,
      ),
    };
    saveDb(next);
    set({ db: next });
  },
  importDb: (imported) => {
    if (!imported || !Array.isArray(imported.patients) || !Array.isArray(imported.scans)) {
      return { success: false, count: 0 };
    }
    const cleanDb: UnivoltDb = {
      patients: imported.patients,
      scans: imported.scans,
      coughs: Array.isArray(imported.coughs) ? imported.coughs : [],
      consults: Array.isArray(imported.consults) ? imported.consults : [],
      meta: { seeded: true, version: 1 },
    };
    saveDb(cleanDb);
    set({ db: cleanDb });
    return { success: true, count: cleanDb.patients.length };
  },
  updateLatestVitalsSpo2: (patientId, spo2, quality) => {
    const db = get().db;
    const patientScans = db.scans
      .map((scan, index) => ({ scan, index }))
      .filter(({ scan }) => scan.patientId === patientId && (!scan.source || scan.source === "scan"))
      .sort((a, b) => b.scan.capturedAt - a.scan.capturedAt);
    const latest = patientScans[0];
    if (!latest) return;
    const scans = db.scans.slice();
    scans[latest.index] = {
      ...latest.scan,
      spo2Estimate: spo2,
      spo2Quality: quality,
    };
    const next = { ...db, scans };
    saveDb(next);
    set({ db: next });
  },
  syncAllRecords: () => {
    const db = get().db;
    const next: UnivoltDb = {
      ...db,
      scans: db.scans.map((s) =>
        s.syncStatus === "local" ? { ...s, syncStatus: "synced" as const } : s,
      ),
      coughs: db.coughs.map((c) =>
        c.syncStatus === "local" ? { ...c, syncStatus: "synced" as const } : c,
      ),
    };
    saveDb(next);
    set({ db: next });
  },
  updatePatientMedical: (patientId, fields) => {
    const db = get().db;
    const next = {
      ...db,
      patients: db.patients.map((p) =>
        p.id === patientId ? { ...p, ...fields } : p,
      ),
    };
    saveDb(next);
    set({ db: next });
  },
  updateCommunicationProfile: (patientId, fields) => {
    const db = get().db;
    const next = {
      ...db,
      patients: db.patients.map((p) =>
        p.id === patientId ? { ...p, ...fields } : p,
      ),
    };
    saveDb(next);
    set({ db: next });
  },
}));

/** Resolve a patient's Communication Assistance profile, defaulting missing fields to "able". */
export function communicationProfile(patient: Patient): CommunicationProfile {
  return {
    canSpeak: patient.canSpeak ?? true,
    canHear: patient.canHear ?? true,
    canRead: patient.canRead ?? true,
  };
}

export function selectPatient(db: UnivoltDb, id: string) {
  return db.patients.find((p) => p.id === id) ?? null;
}

export function selectScans(db: UnivoltDb, patientId: string) {
  return db.scans.filter((s) => s.patientId === patientId).sort((a, b) => a.capturedAt - b.capturedAt);
}

export function selectCoughs(db: UnivoltDb, patientId: string) {
  return db.coughs.filter((c) => c.patientId === patientId).sort((a, b) => a.capturedAt - b.capturedAt);
}

export function latestScan(db: UnivoltDb, patientId: string) {
  const scans = selectScans(db, patientId);
  return scans[scans.length - 1] ?? null;
}

export function latestCough(db: UnivoltDb, patientId: string) {
  const coughs = selectCoughs(db, patientId);
  return coughs[coughs.length - 1] ?? null;
}

export function selectPatientConsults(db: UnivoltDb, patientId: string): TeleConsultRequest[] {
  return (db.consults ?? [])
    .filter((c) => c.patientId === patientId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function selectActiveConsults(db: UnivoltDb): TeleConsultRequest[] {
  const priorityRank: Record<string, number> = {
    urgent: 0,
    phc_today: 1,
    self_care: 2,
    insufficient_data: 3,
  };
  const statusRank: Record<string, number> = {
    requested: 0,
    sent: 1,
    completed: 2,
  };
  return [...(db.consults ?? [])].sort((a, b) => {
    // Urgent-first
    const pDiff = (priorityRank[a.triageLevel] ?? 2) - (priorityRank[b.triageLevel] ?? 2);
    if (pDiff !== 0) return pDiff;
    // Requested before sent before completed
    const sDiff = (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0);
    if (sDiff !== 0) return sDiff;
    // Newest first
    return b.createdAt - a.createdAt;
  });
}
