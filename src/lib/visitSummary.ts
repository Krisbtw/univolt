/**
 * visitSummary.ts — Deterministic, template-based clinical visit summary.
 * Pure logic: no DOM, no React, no network — works fully offline.
 *
 * Returns translation codes + numeric params so the UI layer maps them to
 * display strings. The string "AI" must not appear anywhere in this file or
 * in derived UI.
 */

import {
  HR_MIN_NORMAL,
  HR_MAX_NORMAL,
  RR_MIN_NORMAL,
  RR_MAX_NORMAL,
  SPO2_MIN_NORMAL,
} from "./triage";
import type { FusionLevel } from "./fusionEngine";
import type { VitalsScan } from "./univolt/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VisitVitals {
  hr: number | null;
  rr: number | null;
  spo2: number | null; // null = not measured (camera only, no manual entry)
}

/** A structured line with a translation key + interpolation params. */
export interface SummaryLine {
  key: string;
  params?: Record<string, string | number>;
}

export interface VisitSummary {
  patientId: string;
  generatedAt: number;
  previous: VisitVitals | null;
  current: VisitVitals | null;
  changeLines: SummaryLine[];
  followUpLine: SummaryLine;
}

// ── Delta thresholds for "meaningful change" wording ─────────────────────────

const HR_DELTA_NOTABLE = 10;  // bpm — amber banner threshold per spec
const RR_DELTA_NOTABLE = 4;   // /min
const SPO2_DELTA_NOTABLE = 3; // percentage points

// ── Helpers ───────────────────────────────────────────────────────────────────

function scanToVitals(scan: VitalsScan | null): VisitVitals | null {
  if (!scan) return null;
  // SpO₂ from camera scans is not shown — only manual entries.
  const spo2 = scan.source === "manual" ? scan.spo2Estimate : null;
  return {
    hr:  scan.source === "scan" ? scan.heartRate       : null,
    rr:  scan.source === "scan" ? scan.respiratoryRate : null,
    spo2,
  };
}

function inRange(v: number | null, min: number, max: number): boolean {
  return v == null || (v >= min && v <= max);
}

// ── Change-line generator ─────────────────────────────────────────────────────

function buildChangeLines(
  prev: VisitVitals | null,
  curr: VisitVitals | null,
): SummaryLine[] {
  if (!prev || !curr) return [];

  const lines: SummaryLine[] = [];

  // Heart rate delta
  if (prev.hr != null && curr.hr != null) {
    const delta = curr.hr - prev.hr;
    const absDelta = Math.abs(delta);
    const nowInRange = inRange(curr.hr, HR_MIN_NORMAL, HR_MAX_NORMAL);
    if (absDelta >= HR_DELTA_NOTABLE) {
      lines.push({
        key: delta > 0 ? "vs_hr_up" : "vs_hr_down",
        params: { delta: absDelta, range: nowInRange ? "in_range" : "out_of_range" },
      });
    }
  }

  // Respiratory rate delta
  if (prev.rr != null && curr.rr != null) {
    const delta = curr.rr - prev.rr;
    const absDelta = Math.abs(delta);
    const nowInRange = inRange(curr.rr, RR_MIN_NORMAL, RR_MAX_NORMAL);
    if (absDelta >= RR_DELTA_NOTABLE) {
      lines.push({
        key: delta > 0 ? "vs_rr_up" : "vs_rr_down",
        params: { delta: absDelta, range: nowInRange ? "in_range" : "out_of_range" },
      });
    }
  }

  // SpO₂ delta (manual only)
  if (prev.spo2 != null && curr.spo2 != null) {
    const delta = curr.spo2 - prev.spo2;
    const absDelta = Math.abs(delta);
    const nowInRange = curr.spo2 >= SPO2_MIN_NORMAL;
    if (absDelta >= SPO2_DELTA_NOTABLE) {
      lines.push({
        key: delta > 0 ? "vs_spo2_up" : "vs_spo2_down",
        params: { delta: absDelta, range: nowInRange ? "in_range" : "out_of_range" },
      });
    }
  }

  // All stable fallback
  if (lines.length === 0) {
    lines.push({ key: "vs_all_stable" });
  }

  return lines;
}

// ── Follow-up line from fusion level ─────────────────────────────────────────

function buildFollowUpLine(fusionLevel?: FusionLevel): SummaryLine {
  switch (fusionLevel) {
    case "self_care":         return { key: "vs_followup_self_care" };
    case "phc_today":         return { key: "vs_followup_phc" };
    case "urgent":            return { key: "vs_followup_urgent" };
    case "insufficient_data":
    default:                  return { key: "vs_followup_default" };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic visit summary from a patient's ordered scans.
 * Uses the two most recent "scan" source records for HR + RR,
 * and the two most recent "manual" source records for SpO₂.
 *
 * @param allScans  All scans for this patient (ordered oldest → newest).
 * @param fusionLevel  Optional fusion triage level (drives the follow-up line).
 */
export function generateVisitSummary(
  patientId: string,
  allScans: VitalsScan[],
  fusionLevel?: FusionLevel,
): VisitSummary {
  // Camera scans for HR + RR
  const cameraScans = allScans.filter((s) => !s.source || s.source === "scan");
  const lastCamera  = cameraScans[cameraScans.length - 1] ?? null;
  const prevCamera  = cameraScans[cameraScans.length - 2] ?? null;

  // Manual scans for SpO₂
  const manualScans = allScans.filter((s) => s.source === "manual");
  const lastManual  = manualScans[manualScans.length - 1] ?? null;
  const prevManual  = manualScans[manualScans.length - 2] ?? null;

  // Merge into VisitVitals
  const current: VisitVitals | null = lastCamera
    ? {
        hr: lastCamera.heartRate,
        rr: lastCamera.respiratoryRate,
        spo2: lastManual?.spo2Estimate ?? null,
      }
    : null;

  const previous: VisitVitals | null = prevCamera
    ? {
        hr: prevCamera.heartRate,
        rr: prevCamera.respiratoryRate,
        spo2: prevManual?.spo2Estimate ?? null,
      }
    : null;

  return {
    patientId,
    generatedAt: Date.now(),
    previous,
    current,
    changeLines: buildChangeLines(previous, current),
    followUpLine: buildFollowUpLine(fusionLevel),
  };
}
