import { create } from "zustand";
import { loadOrSeed, makeId, nextCaseId, newPatientInput, saveDb } from "./database";
import type { BloodGroup, CommunicationProfile, CoughResult, Patient, PpgResult, Sex, UnivoltDb } from "./types";

type UnivoltState = {
  ready: boolean;
  db: UnivoltDb;
  init: () => void;
  addPatient: (input: { name: string; age: number; sex: Sex; village: string }) => Patient;
  addVitalsScan: (patientId: string, result: PpgResult, simulated: boolean) => void;
  addCoughScreening: (patientId: string, result: CoughResult) => void;
  /** Add a manual pulse-oximeter SpO₂ reading for a patient. */
  addManualSpo2: (patientId: string, spo2: number) => void;
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
