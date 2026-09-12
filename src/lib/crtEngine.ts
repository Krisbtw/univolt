/**
 * crtEngine.ts — Pure CRT (Capillary Refill Time) signal processing.
 * No DOM, no React. All functions are stateless and testable.
 *
 * Algorithm:
 *   redness index = r / (r + g + b)   (self-normalises against brightness + skin tone)
 *   State machine: baseline → pressed → released → recovered
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface CrtSample {
  tMs: number;
  /** Redness index of the nail ROI (0–1). */
  redness: number;
  /** Redness index of adjacent control skin (0–1). */
  controlRedness: number;
}

export type CrtPhase =
  | "baseline"
  | "pressed"
  | "released"
  | "recovered"
  | "failed";

export interface CrtPhaseResult {
  phase: CrtPhase;
  crtSec: number | null;
  failureReason?: string;
}

export interface CrtResult {
  crtSec: number | null;
  quality: "good" | "weak" | "reject";
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Baseline must be ≥ 1 s of samples before we trust it. */
const BASELINE_MIN_MS = 1_000;
/** Nail redness must drop below 75 % of baseline to count as pressed. */
const PRESS_THRESHOLD_RATIO = 0.75;
/** Redness must rise above 55 % of baseline to count as released. */
const RELEASE_THRESHOLD_RATIO = 0.55;
/** Redness must reach 90 % of baseline to count as recovered. */
const RECOVERY_THRESHOLD_RATIO = 0.90;
/** Cap: if not recovered within 8 s of release → crtSec = null (too slow). */
const RECOVERY_CAP_MS = 8_000;
/** Max allowed shift in CONTROL redness relative to nail, as a ratio. */
const LIGHTING_DRIFT_RATIO = 0.15;
/** Max allowed coefficient of variation for baseline stability gate. */
const BASELINE_CV_MAX = 0.08;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Redness index: r / (r + g + b).
 * Returns 0 when the sum is 0 to avoid division-by-zero.
 */
export function rednessIndex(r: number, g: number, b: number): number {
  const sum = r + g + b;
  return sum > 0 ? r / sum : 0;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], m?: number): number {
  if (arr.length < 2) return 0;
  const mu = m ?? mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length);
}

// ── State machine ─────────────────────────────────────────────────────────────

/**
 * Run the CRT phase state machine over the full sample array.
 *
 * Returns the current phase and crtSec if recovery was detected.
 * Called in the rAF loop on the accumulated ref array — O(n) each frame,
 * which is fine for the short durations involved (< 30 s, ~900 samples max).
 */
export function detectCrtPhases(samples: CrtSample[]): CrtPhaseResult {
  if (samples.length === 0) return { phase: "baseline", crtSec: null };

  const t0 = samples[0]!.tMs;
  const tLast = samples[samples.length - 1]!.tMs;

  // ── Baseline window ────────────────────────────────────────────────────────
  const baselineSamples = samples.filter((s) => s.tMs - t0 < BASELINE_MIN_MS);
  if (baselineSamples.length < 5) {
    // Still collecting baseline
    return { phase: "baseline", crtSec: null };
  }

  const baselineRedness = baselineSamples.map((s) => s.redness);
  const baselineControl = baselineSamples.map((s) => s.controlRedness);
  const baselineMean = mean(baselineRedness);
  const baselineControlMean = mean(baselineControl);

  // Baseline stability gate: reject if too noisy (hand shaking, lighting pulses)
  const cv = baselineMean > 0 ? stdDev(baselineRedness, baselineMean) / baselineMean : 1;
  if (cv > BASELINE_CV_MAX) {
    return { phase: "baseline", crtSec: null }; // still stabilising
  }

  // ── Lighting drift gate ────────────────────────────────────────────────────
  // Compare the full run's control ROI shift vs nail ROI shift.
  const fullNailMean = mean(samples.map((s) => s.redness));
  const fullControlMean = mean(samples.map((s) => s.controlRedness));
  const nailDrift = Math.abs(fullNailMean - baselineMean);
  const controlDrift = Math.abs(fullControlMean - baselineControlMean);
  if (controlDrift > 0.01 && controlDrift > nailDrift * LIGHTING_DRIFT_RATIO) {
    return {
      phase: "failed",
      crtSec: null,
      failureReason: "lighting_drift",
    };
  }

  const pressThresh = baselineMean * PRESS_THRESHOLD_RATIO;
  const releaseThresh = baselineMean * RELEASE_THRESHOLD_RATIO;
  const recoveryThresh = baselineMean * RECOVERY_THRESHOLD_RATIO;

  // Scan for press → release → recovery transitions (after baseline window)
  const postBaseline = samples.filter((s) => s.tMs - t0 >= BASELINE_MIN_MS);
  if (postBaseline.length === 0) return { phase: "baseline", crtSec: null };

  let pressedAt: number | null = null;
  let releasedAt: number | null = null;

  for (const s of postBaseline) {
    if (pressedAt === null) {
      if (s.redness < pressThresh) {
        pressedAt = s.tMs;
      }
    } else if (releasedAt === null) {
      if (s.redness > releaseThresh) {
        releasedAt = s.tMs;
      }
    } else {
      // Watching for recovery
      const sinceRelease = s.tMs - releasedAt;
      if (sinceRelease > RECOVERY_CAP_MS) {
        return {
          phase: "failed",
          crtSec: null,
          failureReason: "recovery_timeout",
        };
      }
      if (s.redness >= recoveryThresh) {
        const crtSec = (s.tMs - releasedAt) / 1000;
        return { phase: "recovered", crtSec };
      }
    }
  }

  // Determine which phase we're currently in
  if (pressedAt === null) {
    // Check if recovery timeout was exceeded even before release was found
    if (tLast - t0 > 30_000) {
      return { phase: "failed", crtSec: null, failureReason: "no_press_detected" };
    }
    return { phase: "baseline", crtSec: null }; // waiting for press
  }
  if (releasedAt === null) {
    return { phase: "pressed", crtSec: null };
  }
  // Pressed and released, waiting for recovery
  const timeSinceRelease = tLast - releasedAt;
  if (timeSinceRelease > RECOVERY_CAP_MS) {
    return { phase: "failed", crtSec: null, failureReason: "recovery_timeout" };
  }
  return { phase: "released", crtSec: null };
}

// ── Result builder ────────────────────────────────────────────────────────────

/** Classify a completed CRT into a quality-tagged result. */
export function buildCrtResult(crtSec: number | null, failureReason?: string): CrtResult {
  if (crtSec === null) {
    return { crtSec: null, quality: "reject" };
  }
  // CRT > 5 s is physiologically plausible but at the extreme — mark weak
  const quality = crtSec <= 5 ? "good" : "weak";
  return { crtSec, quality };
}

/** Classify a CRT seconds value into a clinical category. */
export function classifyCrt(sec: number): "normal" | "borderline" | "slow" {
  if (sec < 2) return "normal";
  if (sec <= 3) return "borderline";
  return "slow";
}
