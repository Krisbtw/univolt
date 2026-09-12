import { create } from "zustand";
import { loadOrSeed, makeId, nextCaseId, newPatientInput, saveDb } from "./database";
import type { CoughResult, Patient, PpgResult, Sex, UnivoltDb } from "./types";

type UnivoltState = {
  ready: boolean;
  db: UnivoltDb;
  init: () => void;
  addPatient: (input: { name: string; age: number; sex: Sex; village: string }) => Patient;
  addVitalsScan: (patientId: string, result: PpgResult, simulated: boolean) => void;
  addCoughScreening: (patientId: string, result: CoughResult) => void;
  /** Mark all 'local' scan and cough records as 'synced' (simulated mesh sync). */
  syncAllRecords: () => void;
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
}));

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
