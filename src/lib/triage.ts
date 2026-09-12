import type { VitalsMetrics } from "./signalProcessing";

export type TriageLevel =
    | "normal"
    | "borderline"
    | "tachycardia"
    | "bradycardia"
    | "hypoxia"
    | "tachypnea"
    | "inconclusive";

// Deterministic thresholds (rubric Task 3).
export const HR_MIN_NORMAL = 60;
export const HR_MAX_NORMAL = 100;
export const HR_TACHY_URGENT = 120;
export const HR_BRADY_REFERRAL = 50;
export const SPO2_MIN_NORMAL = 95;
export const SPO2_HYPOXIA = 94;
export const SPO2_URGENT = 90;
export const RR_MIN_NORMAL = 12;
export const RR_MAX_NORMAL = 20;
export const RR_TACHYPNEA_REFERRAL = 24;

export interface TriageResult {
    level: TriageLevel;
    referral: boolean;
    urgent: boolean;
}

/**
 * Priority: hypoxia > bradycardia > tachypnea > tachycardia > borderline > normal.
 * "borderline" covers the gap zones (HR 50–59, SpO2 94, RR 21–24, or missing
 * but non-abnormal values) with a rest-and-recheck message.
 */
export function evaluateTriage(m: VitalsMetrics): TriageResult {
    const { bpm, spo2, rr } = m;
    if (bpm === null && spo2 === null && rr === null) {
        return { level: "inconclusive", referral: false, urgent: false };
    }
    if (spo2 !== null && spo2 < SPO2_HYPOXIA) {
        return { level: "hypoxia", referral: true, urgent: spo2 < SPO2_URGENT };
    }
    if (bpm !== null && bpm < HR_BRADY_REFERRAL) {
        return { level: "bradycardia", referral: true, urgent: false };
    }
    if (rr !== null && rr > RR_TACHYPNEA_REFERRAL) {
        return { level: "tachypnea", referral: true, urgent: false };
    }
    if (bpm !== null && bpm > HR_MAX_NORMAL) {
        return { level: "tachycardia", referral: true, urgent: bpm > HR_TACHY_URGENT };
    }
    const hrOk = bpm === null || (bpm >= HR_MIN_NORMAL && bpm <= HR_MAX_NORMAL);
    const spo2Ok = spo2 === null || spo2 >= SPO2_MIN_NORMAL;
    const rrOk = rr === null || (rr >= RR_MIN_NORMAL && rr <= RR_MAX_NORMAL);
    if (hrOk && spo2Ok && rrOk) {
        if (bpm === null || spo2 === null || rr === null) {
            return { level: "borderline", referral: false, urgent: false };
        }
        return { level: "normal", referral: false, urgent: false };
    }
    return { level: "borderline", referral: false, urgent: false };
}