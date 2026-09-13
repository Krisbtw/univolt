import type { PriorityFlag } from "./univolt/types";
import type { FusionLevel } from "./fusionEngine";
import { evaluateTriage } from "./triage";

export function getPriorityFromFusion(level: FusionLevel | string | undefined | null): PriorityFlag {
  switch (level) {
    case "urgent":
      return "red";
    case "phc_today":
      return "yellow";
    case "self_care":
    default:
      return "green";
  }
}

export function getPriorityFromVitals(m: {
  bpm: number | null | undefined;
  rr: number | null | undefined;
  spo2: number | null | undefined;
  hrv?: number | null | undefined;
  bpSys?: number | null | undefined;
  bpDia?: number | null | undefined;
  tempC?: number | null | undefined;
}): PriorityFlag {
  // Check severe thresholds first (Red)
  if (m.tempC != null && m.tempC >= 39.5) return "red";
  if (m.bpSys != null && m.bpSys >= 180) return "red";
  if (m.bpDia != null && m.bpDia >= 110) return "red";
  if (m.spo2 != null && m.spo2 < 90) return "red";

  const t = evaluateTriage({
    bpm: m.bpm ?? null,
    rr: m.rr ?? null,
    spo2: m.spo2 ?? null,
    hrv: m.hrv ?? null,
  });
  if (t.urgent || t.level === "hypoxia" || (t.level === "tachycardia" && t.urgent)) {
    return "red";
  }

  // Check moderate thresholds (Yellow)
  if (m.tempC != null && m.tempC >= 38.0) return "yellow";
  if (m.bpSys != null && m.bpSys >= 140) return "yellow";
  if (m.bpDia != null && m.bpDia >= 90) return "yellow";
  if (m.spo2 != null && m.spo2 < 95) return "yellow";

  if (t.referral || t.level === "borderline" || t.level === "tachypnea" || t.level === "bradycardia") {
    return "yellow";
  }
  return "green";
}

export function priorityMeta(flag: PriorityFlag): {
  labelEn: string;
  labelHi: string;
  dotColor: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  emoji: string;
} {
  switch (flag) {
    case "red":
      return {
        labelEn: "Urgent (Red)",
        labelHi: "तत्काल (लाल)",
        dotColor: "bg-red-500",
        badgeBg: "bg-red-500/15",
        badgeBorder: "border-red-500/40",
        textColor: "text-red-400",
        emoji: "🔴",
      };
    case "yellow":
      return {
        labelEn: "Review (Yellow)",
        labelHi: "समीक्षा (पीला)",
        dotColor: "bg-amber-400",
        badgeBg: "bg-amber-400/15",
        badgeBorder: "border-amber-400/40",
        textColor: "text-amber-400",
        emoji: "🟡",
      };
    case "green":
      return {
        labelEn: "Routine (Green)",
        labelHi: "सामान्य (हरा)",
        dotColor: "bg-emerald-400",
        badgeBg: "bg-emerald-400/15",
        badgeBorder: "border-emerald-400/40",
        textColor: "text-emerald-400",
        emoji: "🟢",
      };
  }
}
