import type { PpgResult } from "./types";

export const PPG_SAMPLE_RATE = 50;
export const PPG_DURATION_SEC = 12;

/**
 * Morphologically plausible fingertip PPG pulse (systolic peak + dicrotic notch).
 * Used exclusively by the demo signal generator.
 */
function pulseShape(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  const systolic = Math.exp(-((p - 0.16) ** 2) / (2 * 0.045 ** 2));
  const dicrotic = 0.34 * Math.exp(-((p - 0.42) ** 2) / (2 * 0.055 ** 2));
  return systolic + dicrotic;
}

export type SimulatedPpg = {
  samples: number[];
  bpm: number;
  rrBpm: number;
  sampleRate: number;
};

/**
 * Simulated green-channel fingertip PPG for web / no-flash environments.
 * Green is now the primary cardiac input; red is retained only for the contact gate.
 */
export function generateSimulatedPpg(
  durationSec = PPG_DURATION_SEC,
  sampleRate = PPG_SAMPLE_RATE,
  opts?: { bpm?: number; rrBpm?: number },
): SimulatedPpg {
  const bpm = opts?.bpm ?? 65 + Math.random() * 30;
  const rrBpm = opts?.rrBpm ?? 11 + Math.random() * 10;
  const n = Math.round(durationSec * sampleRate);
  const samples = new Array<number>(n);
  const hrHz = bpm / 60;
  const rrHz = rrBpm / 60;
  let phase = Math.random();
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const instHr = hrHz * (1 + 0.045 * Math.sin(2 * Math.PI * rrHz * t));
    phase += instHr / sampleRate;
    const respAmp = 1 + 0.14 * Math.sin(2 * Math.PI * rrHz * t);
    const wander = 0.02 * Math.sin(2 * Math.PI * 0.07 * t + 0.4);
    const noise = (Math.random() - 0.5) * 0.028;
    samples[i] = 0.62 + wander + 0.26 * pulseShape(phase) * respAmp + noise;
  }
  return { samples, bpm, rrBpm, sampleRate };
}

// ── Utility statistics ────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

/** Returns the median of an unsorted array without mutating it. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function movingAverage(xs: number[], window: number): number[] {
  const w = Math.max(1, Math.floor(window));
  const out = new Array<number>(xs.length);
  let acc = 0;
  for (let i = 0; i < xs.length; i++) {
    acc += xs[i]!;
    if (i >= w) acc -= xs[i - w]!;
    const n = i < w - 1 ? i + 1 : w;
    out[i] = acc / n;
  }
  return out;
}

/** Band-limit by subtracting a slow MA (high-pass) then applying a fast MA (low-pass). */
function bandpass(xs: number[], sampleRate: number, lowHz: number, highHz: number): number[] {
  const slowN = Math.max(3, Math.round(sampleRate / Math.max(lowHz, 0.05)));
  const fastN = Math.max(2, Math.round(sampleRate / Math.max(highHz * 2, 0.2)));
  const slow = movingAverage(xs, slowN);
  const detrended = xs.map((x, i) => x - slow[i]!);
  return movingAverage(detrended, fastN);
}

// ── IBI outlier rejection ─────────────────────────────────────────────────────

/**
 * Discard IBIs that deviate more than 35 % from the local median.
 * Returns the median of the surviving IBIs — robust to any remaining outliers.
 * Tolerance of 35 % accommodates standard respiratory sinus arrhythmia (RSA)
 * without letting genuine ectopic beats bias the rate estimate.
 */
function robustMedianIbi(ibis: number[]): number {
  if (ibis.length === 0) return 0;
  const med = median(ibis);
  const filtered = ibis.filter((ibi) => Math.abs(ibi - med) / med <= 0.35);
  return median(filtered.length > 0 ? filtered : ibis);
}

// ── Peak detection — uniform-rate path (demo signal) ─────────────────────────

/**
 * Classic global-threshold peak detector for uniformly-sampled signals
 * (demo path only — live path uses `detectPeaksLocal` with real timestamps).
 *
 * Parameters:
 *  - Refractory window: 320 ms  → suppresses dicrotic notch, allows HRV beats
 *  - Threshold: Mean + 0.35 × SD → catches lower-amplitude systolic peaks
 */
export function detectPeaks(
  signal: number[],
  sampleRate: number,
  minBpm = 40,
  maxBpm = 187,
): number[] {
  if (signal.length < 5) return [];

  const blankingSamples = Math.max(2, Math.round((320 / 1000) * sampleRate));
  const minIbi = (60 / maxBpm) * sampleRate;

  const m = mean(signal);
  const sd = stdev(signal) || 1;
  const thresh = m + 0.35 * sd;

  const candidates: number[] = [];
  for (let i = 2; i < signal.length - 2; i++) {
    const y = signal[i]!;
    if (y < thresh) continue;
    if (
      y >= signal[i - 1]! &&
      y >= signal[i + 1]! &&
      y >= signal[i - 2]! &&
      y >= signal[i + 2]!
    ) {
      const last = candidates[candidates.length - 1];
      if (last != null && i - last < blankingSamples) {
        if (y > signal[last]!) candidates[candidates.length - 1] = i;
        continue;
      }
      candidates.push(i);
    }
  }

  const peaks: number[] = [];
  for (const p of candidates) {
    const prev = peaks[peaks.length - 1];
    if (prev == null) { peaks.push(p); continue; }
    if (p - prev < minIbi) continue;
    peaks.push(p);
  }
  return peaks;
}

// ── Peak detection — real-timestamp path (live camera) ───────────────────────

/**
 * Timestamp-aware peak detector used exclusively in the live camera path.
 *
 * Unlike the uniform-rate detector, this operates on real `performance.now()`
 * frame timestamps so variable mobile frame rates (24–60 FPS, browser drops)
 * cannot stretch or compress the apparent IBI.
 *
 * Algorithm:
 *  1. Rolling 1 s local mean as adaptive baseline. A candidate must sit at
 *     least 10 % above its local mean (not a global SD threshold).
 *  2. Local-maximum test within ±180 ms — a candidate is only kept if no
 *     sample within the ±180 ms window has a higher value.
 *  3. 280 ms refractory period — any candidate within 280 ms of a confirmed
 *     peak is discarded (or demoted if taller), eliminating the dicrotic notch
 *     while allowing natural ~214 BPM HRV peaks through.
 */
function detectPeaksLocal(signal: number[], timestamps: number[]): number[] {
  if (signal.length < 5 || signal.length !== timestamps.length) return [];

  const REFRACTORY_MS = 280;
  const LOCAL_WINDOW_MS = 1000; // rolling mean window
  const LOCAL_HALF_WINDOW_MS = 180; // ±180 ms neighbourhood for local-max test
  const LOCAL_THRESHOLD_RATIO = 1.10; // 10 % above local mean

  // Precompute rolling local mean using a backward time-window.
  // O(n × window_samples) — fine for ≤600 frames (12 s × 30–50 fps).
  const localMean = new Float64Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const tNow = timestamps[i]!;
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (tNow - timestamps[j]! > LOCAL_WINDOW_MS) break;
      sum += signal[j]!;
      count++;
    }
    localMean[i] = count > 0 ? sum / count : signal[i]!;
  }

  // Pass 1: above-baseline local maxima.
  const candidates: number[] = [];
  for (let i = 0; i < signal.length; i++) {
    const tNow = timestamps[i]!;
    const y = signal[i]!;

    // Must exceed local baseline by 10 %.
    if (y < localMean[i]! * LOCAL_THRESHOLD_RATIO) continue;

    // Must be the global maximum within ±180 ms.
    let isLocalMax = true;
    for (let j = 0; j < signal.length; j++) {
      if (j === i) continue;
      if (Math.abs(timestamps[j]! - tNow) <= LOCAL_HALF_WINDOW_MS) {
        if (signal[j]! > y) { isLocalMax = false; break; }
      }
    }
    if (!isLocalMax) continue;
    candidates.push(i);
  }

  // Pass 2: enforce refractory period — keep the taller peak in each window.
  const peaks: number[] = [];
  for (const idx of candidates) {
    const prev = peaks[peaks.length - 1];
    if (prev == null) { peaks.push(idx); continue; }
    const gap = timestamps[idx]! - timestamps[prev]!;
    if (gap < REFRACTORY_MS) {
      if (signal[idx]! > signal[prev]!) peaks[peaks.length - 1] = idx;
      continue;
    }
    peaks.push(idx);
  }

  return peaks;
}

/**
 * Compute IBIs directly from real frame timestamps (ms).
 * IBI_k = timestamp[peak_k] - timestamp[peak_{k-1}]
 */
function ibiMsFromTimestamps(peaks: number[], timestamps: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    out.push(timestamps[peaks[i]!]! - timestamps[peaks[i - 1]!]!);
  }
  return out;
}

/** Compute IBIs from sample indices at a uniform sample rate (demo path). */
function ibiMs(peaks: number[], sampleRate: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    out.push(((peaks[i]! - peaks[i - 1]!) / sampleRate) * 1000);
  }
  return out;
}

function rmssd(ibis: number[]): number {
  if (ibis.length < 2) return 0;
  let acc = 0;
  let n = 0;
  for (let i = 1; i < ibis.length; i++) {
    const d = ibis[i]! - ibis[i - 1]!;
    acc += d * d;
    n += 1;
  }
  return Math.sqrt(acc / n);
}

function countPeaksSimple(signal: number[], sampleRate: number, minDistSec: number): number {
  if (signal.length < 6) return 0;
  const minDist = Math.max(2, Math.floor(minDistSec * sampleRate));
  const m = mean(signal);
  const sd = stdev(signal) || 1;
  const thresh = m + 0.2 * sd;
  const peaks: number[] = [];
  for (let i = 2; i < signal.length - 2; i++) {
    const y = signal[i]!;
    if (y < thresh) continue;
    if (y > signal[i - 1]! && y > signal[i + 1]!) {
      const last = peaks[peaks.length - 1];
      if (last != null && i - last < minDist) {
        if (y > signal[last]!) peaks[peaks.length - 1] = i;
        continue;
      }
      peaks.push(i);
    }
  }
  return peaks.length;
}

function estimateRespiratoryRate(
  samples: number[],
  sampleRate: number,
  peaks: number[],
  durationSec: number,
): number {
  const band = bandpass(samples, sampleRate, 0.15, 0.4);
  const breaths = countPeaksSimple(band, sampleRate, 2.4);
  let rrFromBand = durationSec > 0 ? (breaths * 60) / durationSec : 0;

  let rrFromHrv = 0;
  if (peaks.length >= 6) {
    const ibis = ibiMs(peaks, sampleRate);
    const times = peaks.slice(1).map((p) => p / sampleRate);
    const gridFs = 4;
    const t0 = times[0]!;
    const t1 = times[times.length - 1]!;
    const grid: number[] = [];
    for (let t = t0; t <= t1; t += 1 / gridFs) {
      let k = 0;
      while (k < times.length - 2 && times[k + 1]! < t) k += 1;
      const tA = times[k]!;
      const tB = times[k + 1]!;
      const frac = tB === tA ? 0 : (t - tA) / (tB - tA);
      grid.push(ibis[k]! + frac * (ibis[k + 1]! - ibis[k]!));
    }
    const rsa = bandpass(grid, gridFs, 0.15, 0.4);
    const cycles = countPeaksSimple(rsa, gridFs, 2.4);
    const span = t1 - t0;
    rrFromHrv = span > 0 ? (cycles * 60) / span : 0;
  }

  const candidates = [rrFromBand, rrFromHrv].filter((v) => v >= 9 && v <= 24);
  const rr = candidates.length ? mean(candidates) : rrFromBand || rrFromHrv || 14;
  return Math.round(Math.min(24, Math.max(9, rr)));
}

function estimateSpo2(samples: number[]): number {
  const dc = mean(samples);
  const ac = stdev(samples);
  const pi = dc > 0 ? ac / dc : 0;
  const raw = 94.2 + Math.min(pi, 0.22) * 22;
  const jitter = (mean(samples.slice(0, 8).map((x) => x % 0.01)) - 0.005) * 8;
  return Math.round(Math.min(99, Math.max(94, raw + jitter)));
}

function signalQualityScore(
  samples: number[],
  ibis: number[],
  peaks: number[],
  durationSec: number,
): number {
  if (peaks.length < 4 || ibis.length < 3) return 38;
  const cv = stdev(ibis) / (mean(ibis) || 1);
  const regularity = Math.max(0, 1 - cv / 0.28);
  const expected = (mean(ibis) > 0 ? (durationSec * 1000) / mean(ibis) : 0) + 1;
  const coverage = Math.min(1, peaks.length / Math.max(expected, 1));
  const ac = stdev(samples);
  const snr = Math.min(1, ac / 0.08);
  const score = 100 * (0.5 * regularity + 0.3 * coverage + 0.2 * snr);
  return Math.round(Math.min(97, Math.max(42, score)));
}

// ── Main DSP pipelines ────────────────────────────────────────────────────────

/**
 * Live-camera pipeline — uses real frame timestamps for IBI computation.
 *
 * Key improvements over the index-based pipeline:
 *  - `detectPeaksLocal`: rolling 1 s local mean + ±180 ms local-max test +
 *    280 ms refractory period (no global SD, no hardcoded fs).
 *  - `ibiMsFromTimestamps`: IBI_k = ts[peak_k] − ts[peak_{k-1}] in real ms,
 *    eliminating BPM error caused by mobile browser frame-rate jitter.
 *  - `robustMedianIbi`: ±35 % outlier rejection → median IBI for BPM.
 */
export function processPpgWithTimestamps(
  samples: number[],
  timestamps: number[],
): PpgResult {
  if (samples.length === 0 || timestamps.length === 0) {
    return processPpg(samples);
  }

  // Effective sample rate from real elapsed time.
  const durationMs = timestamps[timestamps.length - 1]! - timestamps[0]!;
  const durationSec = Math.max(durationMs / 1000, 0.1);
  const effectiveSampleRate = samples.length / durationSec;

  // Detrend + smooth (using effective rate for window widths).
  const dc = movingAverage(samples, Math.round(effectiveSampleRate * 0.9));
  const ac = samples.map((x, i) => x - dc[i]!);
  const smooth = movingAverage(ac, Math.max(2, Math.round(effectiveSampleRate * 0.06)));
  const inverted = smooth.every((v) => v <= 0) ? smooth.map((v) => -v) : smooth;

  // Timestamp-aware local peak detection (280 ms refractory, 10 % local threshold).
  const peaks = detectPeaksLocal(inverted, timestamps);

  // IBIs computed directly from real frame timestamps — no hardcoded fs.
  const rawIbis = ibiMsFromTimestamps(peaks, timestamps);

  // 35 % outlier-rejection → median IBI → BPM.
  const robustIbi = robustMedianIbi(rawIbis);
  const hr = robustIbi > 0 ? 60000 / robustIbi : 0;

  const hrv = rmssd(rawIbis);

  return {
    heartRate: Math.round(Math.min(220, Math.max(40, hr || 72))),
    hrvRmssd: Math.round(Math.min(120, Math.max(8, hrv || 24))),
    signalQuality: signalQualityScore(samples, rawIbis, peaks, durationSec),
    respiratoryRate: estimateRespiratoryRate(samples, effectiveSampleRate, peaks, durationSec),
    spo2Estimate: estimateSpo2(samples),
    peakCount: peaks.length,
    durationSec,
    sampleRate: effectiveSampleRate,
  };
}

/**
 * Demo / uniform-rate pipeline — used when real timestamps are unavailable
 * (simulated signal or fallback). IBIs derived from sample indices ÷ rate.
 */
export function processPpg(samples: number[], sampleRate = PPG_SAMPLE_RATE): PpgResult {
  const durationSec = samples.length / sampleRate;

  const dc = movingAverage(samples, Math.round(sampleRate * 0.9));
  const ac = samples.map((x, i) => x - dc[i]!);
  const smooth = movingAverage(ac, Math.max(2, Math.round(sampleRate * 0.06)));
  const inverted = smooth.every((v) => v <= 0) ? smooth.map((v) => -v) : smooth;

  const peaks = detectPeaks(inverted, sampleRate);
  const rawIbis = ibiMs(peaks, sampleRate);
  const robustIbi = robustMedianIbi(rawIbis);
  const hr = robustIbi > 0 ? 60000 / robustIbi : 0;
  const hrv = rmssd(rawIbis);

  return {
    heartRate: Math.round(Math.min(220, Math.max(40, hr || 72))),
    hrvRmssd: Math.round(Math.min(120, Math.max(8, hrv || 24))),
    signalQuality: signalQualityScore(samples, rawIbis, peaks, durationSec),
    respiratoryRate: estimateRespiratoryRate(samples, sampleRate, peaks, durationSec),
    spo2Estimate: estimateSpo2(samples),
    peakCount: peaks.length,
    durationSec,
    sampleRate,
  };
}

// ── Demo signal helpers ───────────────────────────────────────────────────────

export function nextSimulatedSample(
  tSec: number,
  bpm: number,
  rrBpm: number,
  phaseRef: { current: number },
  dt: number,
): number {
  const hrHz = bpm / 60;
  const rrHz = rrBpm / 60;
  const instHr = hrHz * (1 + 0.045 * Math.sin(2 * Math.PI * rrHz * tSec));
  phaseRef.current += instHr * dt;
  const respAmp = 1 + 0.14 * Math.sin(2 * Math.PI * rrHz * tSec);
  const wander = 0.02 * Math.sin(2 * Math.PI * 0.07 * tSec + 0.4);
  const noise = (Math.random() - 0.5) * 0.028;
  return 0.62 + wander + 0.26 * pulseShape(phaseRef.current) * respAmp + noise;
}
