import type { TriageLevel } from "./triage";
import type { Locale } from "./translations";

export interface ScanRecord {
    id: string;
    timestamp: number;
    mode: "live" | "demo" | "manual";
    bpm: number | null;
    hrv: number | null;
    spo2: number | null;
    rr: number | null;
    locale: Locale;
    triageLevel: TriageLevel;
}

const SCANS_KEY = "univolt.scans.v1";
const LOCALE_KEY = "univolt.locale.v1";
const MAX_HISTORY = 50;

const TRIAGE_LEVELS: readonly TriageLevel[] = [
    "normal",
    "borderline",
    "tachycardia",
    "bradycardia",
    "hypoxia",
    "tachypnea",
    "inconclusive",
];

function storage(): Storage | null {
    try {
        return typeof window !== "undefined" && window.localStorage
            ? window.localStorage
            : null;
    } catch {
        return null;
    }
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function numOrNull(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function makeId(): string {
    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
    } catch {
        // fall through to timestamp-based id
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadScans(): ScanRecord[] {
    const store = storage();
    if (!store) return [];
    try {
        const raw = store.getItem(SCANS_KEY);
        if (raw === null) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const out: ScanRecord[] = [];
        for (const item of parsed) {
            if (!isRecord(item)) continue;
            const id = typeof item.id === "string" ? item.id : null;
            const timestamp = numOrNull(item.timestamp);
            const mode = item.mode === "live" || item.mode === "demo" || item.mode === "manual" ? item.mode : null;
            const locale = item.locale === "en" || item.locale === "hi" ? item.locale : null;
            const rawLevel: unknown = item.triageLevel;
            const triageLevel =
                typeof rawLevel === "string"
                    ? (TRIAGE_LEVELS.find((l) => l === rawLevel) ?? null)
                    : null;
            if (
                id === null ||
                timestamp === null ||
                mode === null ||
                locale === null ||
                triageLevel === null
            ) {
                continue;
            }
            out.push({
                id,
                timestamp,
                mode,
                bpm: numOrNull(item.bpm),
                hrv: numOrNull(item.hrv),
                spo2: numOrNull(item.spo2),
                rr: numOrNull(item.rr),
                locale,
                triageLevel,
            });
        }
        return out.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
        return [];
    }
}

export function saveScan(record: ScanRecord): void {
    const store = storage();
    if (!store) return;
    const scans = loadScans();
    scans.unshift(record);
    try {
        store.setItem(SCANS_KEY, JSON.stringify(scans.slice(0, MAX_HISTORY)));
    } catch {
        // storage full or blocked — scan is still shown in-session
    }
}

export function clearScans(): void {
    const store = storage();
    if (!store) return;
    try {
        store.removeItem(SCANS_KEY);
    } catch {
        // ignore
    }
}

export function loadLocale(): Locale | null {
    const store = storage();
    if (!store) return null;
    try {
        const v = store.getItem(LOCALE_KEY);
        return v === "en" || v === "hi" ? v : null;
    } catch {
        return null;
    }
}

export function saveLocale(locale: Locale): void {
    const store = storage();
    if (!store) return;
    try {
        store.setItem(LOCALE_KEY, locale);
    } catch {
        // ignore
    }
}