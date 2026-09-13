/**
 * fusionEngine.ts — Deterministic triage fusion.
 * Pure logic: no DOM, no React, no I/O. Returns null-safe outputs.
 *
 * Priority chain: urgent > phc_today > self_care > insufficient_data
 */

import { SPO2_HYPOXIA, SPO2_URGENT } from "./triage";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FusionSymptoms {
  breathless?: boolean;
  chestPain?: boolean;
  fainting?: boolean;
  bleeding?: boolean;
  feverDays?: number;
}

export interface FusionRppg {
  bpm: number | null;
  rr: number | null;
  hrv: number | null;
  quality: "good" | "weak" | "reject";
}

export interface FusionSpo2 {
  value: number | null;
  quality: "good" | "weak" | "reject" | "manual";
}

export interface FusionInputs {
  ageYears?: number;
  pregnant?: boolean;
  symptoms?: FusionSymptoms;
  rppg?: FusionRppg;
  spo2?: FusionSpo2;
  crtSec?: number | null;
  fetSec?: number | null;
}

export type FusionLevel = "insufficient_data" | "self_care" | "phc_today" | "urgent";

export interface FusionReason {
  /** Machine-readable code — map to display strings in the UI layer. */
  code: string;
  /** Relative weight, higher = stronger contribution to the decision. */
  weight: number;
}

export interface FusionResult {
  level: FusionLevel;
  reasons: FusionReason[];
  /** Number of distinct physiological signals that were actually measured. */
  signalsUsed: number;
}

// ── Normal ranges (shared with triage.ts) ────────────────────────────────────

const HR_MIN = 60;
const HR_MAX = 100;
const HR_TACHY = 120;
const HR_EXTREME = 150;
const HR_BRADY = 50;
const RR_MIN = 12;
const RR_MAX = 20;
const RR_TACHYPNEA = 24;
const CRT_BORDERLINE = 3;
const CRT_ABNORMAL = 5;
const FET_OBSTRUCTION = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when rPPG quality is "reject" (treat as unmeasured). */
function rppgRejected(r: FusionRppg | undefined): boolean {
  return !r || r.quality === "reject";
}

/** True when rPPG quality is "weak" — signals may not escalate beyond phc_today without symptoms. */
function rppgWeak(r: FusionRppg | undefined): boolean {
  return !!r && r.quality === "weak";
}

function spo2Rejected(s: FusionSpo2 | undefined): boolean {
  return !s || s.quality === "reject" || s.value == null;
}

// ── Main evaluator ────────────────────────────────────────────────────────────

export function evaluateFusion(inputs: FusionInputs): FusionResult {
  const { ageYears, pregnant, symptoms: sx, rppg, spo2, crtSec, fetSec } = inputs;
  const reasons: FusionReason[] = [];

  // Count measured signals (for the insufficient_data gate).
  let signalsUsed = 0;
  const bpmMeasured = !rppgRejected(rppg) && rppg?.bpm != null;
  const rrMeasured = !rppgRejected(rppg) && rppg?.rr != null;
  const spo2Measured = !spo2Rejected(spo2);
  const crtMeasured = crtSec != null;
  const fetMeasured = fetSec != null;

  if (bpmMeasured) signalsUsed++;
  if (rrMeasured) signalsUsed++;
  if (spo2Measured) signalsUsed++;
  if (crtMeasured) signalsUsed++;
  if (fetMeasured) signalsUsed++;

  const bpm = bpmMeasured ? rppg!.bpm! : null;
  const rr = rrMeasured ? rppg!.rr! : null;
  const spo2Value = spo2Measured ? spo2!.value! : null;
  const crt = crtMeasured ? crtSec! : null;
  const fet = fetMeasured ? fetSec! : null;

  // Red-flag symptoms (immediately counted, can override weak-signal cap).
  const redFlagSx =
    sx?.chestPain ||
    sx?.fainting ||
    sx?.bleeding ||
    (sx?.feverDays != null && sx.feverDays >= 3) ||
    sx?.breathless;

  // ── URGENT ────────────────────────────────────────────────────────────────
  // Weak-quality signals may NOT push to urgent unless a symptom red-flag exists.
  const canUrgent = !rppgWeak(rppg) || !!redFlagSx;

  if (canUrgent && bpm != null && bpm > HR_EXTREME) {
    reasons.push({ code: "bpm_extreme", weight: 10 });
  }
  if (spo2Value != null && spo2Value < SPO2_URGENT) {
    reasons.push({ code: "spo2_urgent", weight: 10 });
  }
  if (canUrgent && bpm != null && bpm > HR_TACHY && crt != null && crt > CRT_BORDERLINE) {
    reasons.push({ code: "shock_pattern", weight: 10 });
  }
  if (sx?.chestPain) reasons.push({ code: "chest_pain", weight: 10 });
  if (sx?.fainting) reasons.push({ code: "fainting", weight: 10 });
  if (sx?.bleeding) reasons.push({ code: "bleeding", weight: 10 });

  if (reasons.some((r) => r.weight >= 10)) {
    return { level: "urgent", reasons, signalsUsed };
  }

  // ── PHC TODAY ─────────────────────────────────────────────────────────────
  const canEscalatePast = !rppgWeak(rppg) || !!redFlagSx;

  if (fet != null && fet > FET_OBSTRUCTION) {
    reasons.push({ code: "fet_obstruction", weight: 7 });
  }
  if (canEscalatePast && bpm != null && bpm > HR_MAX) {
    reasons.push({ code: "tachycardia", weight: 6 });
  }
  if (canEscalatePast && bpm != null && bpm < HR_BRADY) {
    reasons.push({ code: "bradycardia", weight: 6 });
  }
  if (rr != null && rr > RR_TACHYPNEA) {
    reasons.push({ code: "tachypnea", weight: 6 });
  }
  if (spo2Value != null && spo2Value >= SPO2_URGENT && spo2Value < SPO2_HYPOXIA + 1) {
    reasons.push({ code: "spo2_low", weight: 6 });
  }
  if (crt != null && crt >= CRT_BORDERLINE && crt <= CRT_ABNORMAL) {
    reasons.push({ code: "crt_elevated", weight: 5 });
  }
  if (pregnant && signalsUsed > 0) {
    // Any abnormal signal in a pregnant patient escalates.
    const abnormal = reasons.length > 0;
    if (abnormal) reasons.push({ code: "pregnant_abnormal", weight: 4 });
  }
  if (sx?.feverDays != null && sx.feverDays >= 3) {
    reasons.push({ code: "fever_3d", weight: 5 });
  }
  if (sx?.breathless) {
    reasons.push({ code: "breathless", weight: 5 });
  }

  if (reasons.some((r) => r.weight >= 4)) {
    return { level: "phc_today", reasons, signalsUsed };
  }

  // ── INSUFFICIENT DATA ──────────────────────────────────────────────────────
  if (signalsUsed < 2 && !redFlagSx) {
    return { level: "insufficient_data", reasons, signalsUsed };
  }

  // ── SELF CARE ─────────────────────────────────────────────────────────────
  const hrOk = bpm == null || (bpm >= HR_MIN && bpm <= HR_MAX);
  const rrOk = rr == null || (rr >= RR_MIN && rr <= RR_MAX);
  const spo2Ok = spo2Value == null || spo2Value >= SPO2_HYPOXIA + 1;
  const crtOk = crt == null || crt < CRT_BORDERLINE;
  const fetOk = fet == null || fet <= FET_OBSTRUCTION;
  const sxOk = !redFlagSx;

  if (hrOk && rrOk && spo2Ok && crtOk && fetOk && sxOk) {
    reasons.push({ code: "all_normal", weight: 1 });
    return { level: "self_care", reasons, signalsUsed };
  }

  // Borderline / insufficient
  return { level: "insufficient_data", reasons, signalsUsed };
}
