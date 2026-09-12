import type {
  CoughScreening,
  Patient,
  Sex,
  UnivoltDb,
  VitalsScan,
} from "./types";

const DB_KEY = "univolt.db.v1";
const META_FLAG = "univolt.seeded.v1";
const DB_VERSION = 1;

let memoryDb: UnivoltDb | null = null;

function emptyDb(): UnivoltDb {
  return {
    patients: [],
    scans: [],
    coughs: [],
    meta: { seeded: false, version: DB_VERSION },
  };
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage;
    const k = "__univolt_probe";
    s.setItem(k, "1");
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

function daysAgo(days: number, hours = 10): number {
  return Date.now() - days * 86_400_000 - hours * 3_600_000;
}

function seedPatients(): { patients: Patient[]; scans: VitalsScan[]; coughs: CoughScreening[] } {
  const patients: Patient[] = [
    {
      id: "p-meera",
      caseId: "UV-1042",
      name: "Meera Devi",
      age: 58,
      sex: "F",
      village: "Rampur Kalan",
      createdAt: daysAgo(40, 4),
      lastVisitAt: daysAgo(2, 8),
    },
    {
      id: "p-ramesh",
      caseId: "UV-1088",
      name: "Ramesh Kumar",
      age: 44,
      sex: "M",
      village: "Khetri",
      createdAt: daysAgo(28, 2),
      lastVisitAt: daysAgo(5, 11),
    },
    {
      id: "p-anjali",
      caseId: "UV-1120",
      name: "Anjali Singh",
      age: 26,
      sex: "F",
      village: "Bhilwara",
      createdAt: daysAgo(18, 6),
      lastVisitAt: daysAgo(1, 5),
    },
  ];

  const scans: VitalsScan[] = [
    scan("s-meera-1", "p-meera", daysAgo(12, 9), 74, 32, 82, 15, 98),
    scan("s-meera-2", "p-meera", daysAgo(7, 7), 78, 28, 76, 16, 97),
    scan("s-meera-3", "p-meera", daysAgo(2, 8), 82, 24, 88, 18, 96),
    scan("s-ramesh-1", "p-ramesh", daysAgo(14, 6), 66, 42, 90, 12, 99),
    scan("s-ramesh-2", "p-ramesh", daysAgo(5, 11), 70, 38, 85, 13, 98),
    scan("s-anjali-1", "p-anjali", daysAgo(9, 4), 88, 22, 70, 19, 97),
    scan("s-anjali-2", "p-anjali", daysAgo(4, 9), 84, 26, 80, 17, 96),
    scan("s-anjali-3", "p-anjali", daysAgo(1, 5), 76, 30, 91, 14, 98),
  ];

  const coughs: CoughScreening[] = [
    cough("c-meera-1", "p-meera", daysAgo(12, 9), "Normal", false),
    cough(
      "c-meera-2",
      "p-meera",
      daysAgo(2, 8),
      "Possible irregular breathing pattern — refer for clinical follow-up",
      false,
    ),
    cough("c-ramesh-1", "p-ramesh", daysAgo(5, 11), "Normal", false),
    cough(
      "c-anjali-1",
      "p-anjali",
      daysAgo(9, 4),
      "Possible irregular breathing pattern — refer for clinical follow-up",
      false,
    ),
    cough("c-anjali-2", "p-anjali", daysAgo(1, 5), "Normal", false),
  ];

  return { patients, scans, coughs };
}

function scan(
  id: string,
  patientId: string,
  capturedAt: number,
  heartRate: number,
  hrvRmssd: number,
  signalQuality: number,
  respiratoryRate: number,
  spo2Estimate: number,
): VitalsScan {
  return {
    id,
    patientId,
    capturedAt,
    heartRate,
    hrvRmssd,
    signalQuality,
    respiratoryRate,
    spo2Estimate,
    peakCount: Math.round((heartRate / 60) * 12),
    durationSec: 12,
    simulated: true,
    syncStatus: "local",
  };
}

function cough(
  id: string,
  patientId: string,
  capturedAt: number,
  classification: CoughScreening["classification"],
  simulated: boolean,
): CoughScreening {
  const irregular = classification !== "Normal";
  return {
    id,
    patientId,
    capturedAt,
    classification,
    zeroCrossingRate: irregular ? 640 : 210,
    energyVariance: irregular ? 0.0042 : 0.00031,
    durationSec: 6,
    simulated,
    notes: irregular
      ? "Seeded screening — bursty energy envelope."
      : "Seeded screening — quiet breathing band.",
    syncStatus: "local",
  };
}

function migrate(raw: unknown): UnivoltDb {
  const db = (raw ?? emptyDb()) as Partial<UnivoltDb>;
  const patients = Array.isArray(db.patients) ? db.patients : [];
  const scans = (Array.isArray(db.scans) ? db.scans : []).map((s) => ({
    ...s,
    respiratoryRate: s.respiratoryRate ?? 14,
    spo2Estimate: s.spo2Estimate ?? 97,
    hrvRmssd: s.hrvRmssd ?? 28,
    signalQuality: s.signalQuality ?? 80,
    syncStatus: s.syncStatus ?? "local",
  }));
  const coughs = Array.isArray(db.coughs) ? db.coughs : [];
  return {
    patients,
    scans,
    coughs,
    meta: {
      seeded: db.meta?.seeded ?? patients.length > 0,
      version: DB_VERSION,
    },
  };
}

function persist(db: UnivoltDb) {
  memoryDb = db;
  const s = storage();
  if (!s) return;
  s.setItem(DB_KEY, JSON.stringify(db));
  if (db.meta.seeded) s.setItem(META_FLAG, "1");
}

/**
 * Web stand-in for the Expo SQLite layer (`database.ts`).
 * Stores patients, vitals (including respiratory_rate + spo2_estimate),
 * and cough_screening_result locally. Seeds once when the patients table is empty.
 */
export function loadOrSeed(): UnivoltDb {
  if (memoryDb) return memoryDb;
  const s = storage();
  if (s) {
    const existing = s.getItem(DB_KEY);
    if (existing) {
      try {
        const db = migrate(JSON.parse(existing));
        if (db.patients.length > 0) {
          db.meta.seeded = true;
          persist(db);
          return db;
        }
      } catch {
        // fall through to seed
      }
    }
    if (s.getItem(META_FLAG) === "1") {
      const db = migrate(null);
      persist(db);
      return db;
    }
  } else if (memoryDb) {
    return memoryDb;
  }

  const seeded = seedPatients();
  const db: UnivoltDb = {
    ...seeded,
    meta: { seeded: true, version: DB_VERSION },
  };
  persist(db);
  return db;
}

export function saveDb(db: UnivoltDb) {
  persist({ ...db, meta: { ...db.meta, version: DB_VERSION } });
}

export function nextCaseId(patients: Patient[]): string {
  const nums = patients.map((p) => {
    const m = /^UV-(\d+)$/.exec(p.caseId);
    return m ? Number(m[1]) : 1000;
  });
  const next = (nums.length ? Math.max(...nums) : 1120) + 1;
  return `UV-${next}`;
}

export function makeId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${rand}`;
}

export function newPatientInput(input: {
  name: string;
  age: number;
  sex: Sex;
  village: string;
  caseId: string;
}): Patient {
  const now = Date.now();
  return {
    id: makeId("p"),
    caseId: input.caseId,
    name: input.name.trim(),
    age: input.age,
    sex: input.sex,
    village: input.village.trim(),
    createdAt: now,
    lastVisitAt: now,
  };
}
