/**
 * breathAudioEngine.ts — Pure FET (Forced Expiratory Time) audio DSP.
 * No DOM, no React. All functions are stateless and testable in isolation.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type FetClassification = "reject" | "normal" | "borderline" | "obstruction";

export interface ExhalationSegment {
  startIdx: number;
  endIdx: number;
  durationSec: number;
}

export interface FetResult {
  trialSecs: number[];
  bestSec: number | null;
  quality: "good" | "weak" | "reject";
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum sustained energy duration to count as onset (samples at 60 Hz). */
const ONSET_MIN_SAMPLES = Math.round(0.15 * 60); // 150 ms at 60 Hz

/** Minimum quiet duration after peak to count as end of exhalation (samples at 60 Hz). */
const OFFSET_MIN_SAMPLES = Math.round(0.4 * 60); // 400 ms at 60 Hz

/** Safety floor for noise multiplier — prevents false positives in near-silence. */
const FIXED_ENERGY_FLOOR = 0.003;

// ── RMS computation ──────────────────────────────────────────────────────────

/**
 * Compute the RMS energy of a Float32Array time-domain buffer (from AnalyserNode).
 * Returns 0 when the buffer is empty.
 */
export function computeRms(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i]! * buffer[i]!;
  }
  return Math.sqrt(sum / buffer.length);
}

// ── Noise floor ───────────────────────────────────────────────────────────────

/**
 * Estimate ambient noise floor from the first second of captured RMS samples.
 * Returns the 90th percentile of the ambient envelope.
 */
export function estimateNoiseFloor(ambientEnvelope: number[]): number {
  if (ambientEnvelope.length === 0) return FIXED_ENERGY_FLOOR;
  const sorted = ambientEnvelope.slice().sort((a, b) => a - b);
  const p90idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return Math.max(sorted[p90idx] ?? FIXED_ENERGY_FLOOR, FIXED_ENERGY_FLOOR);
}

// ── Exhalation detection ─────────────────────────────────────────────────────

/**
 * Detect a single exhalation segment from a RMS envelope array.
 * onset  = sustained energy above max(3 × noiseFloor, FIXED_ENERGY_FLOOR) for ≥ 150 ms
 * offset = energy below threshold for ≥ 400 ms after the onset
 *
 * @param envelope   Array of RMS values sampled at ~60 Hz.
 * @param noiseFloor Ambient noise estimate from estimateNoiseFloor().
 * @param sampleRate Samples per second (default 60).
 */
export function detectExhalation(
  envelope: number[],
  noiseFloor: number,
  sampleRate = 60,
): ExhalationSegment | null {
  const threshold = Math.max(3 * noiseFloor, FIXED_ENERGY_FLOOR);
  const onsetMinSamples = Math.round(0.15 * sampleRate);
  const offsetMinSamples = Math.round(0.4 * sampleRate);

  let onsetCandidate = -1;
  let onsetConfirmed = -1;
  let aboveCount = 0;
  let belowCount = 0;

  for (let i = 0; i < envelope.length; i++) {
    const energy = envelope[i]!;
    if (onsetConfirmed === -1) {
      // Looking for onset
      if (energy >= threshold) {
        if (onsetCandidate === -1) onsetCandidate = i;
        aboveCount++;
        if (aboveCount >= onsetMinSamples) {
          onsetConfirmed = onsetCandidate;
        }
      } else {
        onsetCandidate = -1;
        aboveCount = 0;
      }
    } else {
      // Onset confirmed — look for offset
      if (energy < threshold) {
        belowCount++;
        if (belowCount >= offsetMinSamples) {
          const endIdx = i - offsetMinSamples;
          const durationSec = (endIdx - onsetConfirmed) / sampleRate;
          return { startIdx: onsetConfirmed, endIdx, durationSec };
        }
      } else {
        belowCount = 0;
      }
    }
  }

  // Exhalation reached end of buffer without silence offset (still exhaling or truncated).
  if (onsetConfirmed !== -1) {
    const endIdx = envelope.length - 1;
    const durationSec = (endIdx - onsetConfirmed) / sampleRate;
    return { startIdx: onsetConfirmed, endIdx, durationSec };
  }

  return null;
}

// ── Classification ────────────────────────────────────────────────────────────

/**
 * Classify a FET duration in seconds:
 *  < 1 s  → reject  (not a valid exhalation — cough, breath-hold, mic noise)
 *  < 4 s  → normal
 *  4–6 s  → borderline
 *  > 6 s  → obstruction (suggests airway obstruction per WHO bedside test)
 */
export function classifyFet(sec: number): FetClassification {
  if (sec < 1) return "reject";
  if (sec < 4) return "normal";
  if (sec <= 6) return "borderline";
  return "obstruction";
}

// ── Result builder ────────────────────────────────────────────────────────────

/**
 * Build a FetResult from a list of trial durations.
 * Filters out reject trials (< 1 s), keeps the best (longest valid).
 * quality: "reject" if no valid trials, "weak" if only one valid trial, "good" otherwise.
 */
export function buildFetResult(trialSecs: number[]): FetResult {
  const valid = trialSecs.filter((s) => classifyFet(s) !== "reject");
  if (valid.length === 0) {
    return { trialSecs, bestSec: null, quality: "reject" };
  }
  const bestSec = Math.max(...valid);
  return {
    trialSecs,
    bestSec,
    quality: valid.length >= 2 ? "good" : "weak",
  };
}
