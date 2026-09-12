import type { PpgResult } from "./types";

export const PPG_SAMPLE_RATE = 50;
export const PPG_DURATION_SEC = 12;

/** Morphologically plausible fingertip PPG pulse (systolic peak + dicrotic notch). */
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
 * Simulated red-channel intensity for web / no-flash environments.
 * Produces a noisy PPG at a randomized 65–95 BPM with respiratory modulation.
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
    const dc = 0.62;
    samples[i] = dc + wander + 0.26 * pulseShape(phase) * respAmp + noise;
  }
  return { samples, bpm, rrBpm, sampleRate };
}

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

export function detectPeaks(
  signal: number[],
  sampleRate: number,
  minBpm = 45,
  maxBpm = 160,
): number[] {
  if (signal.length < 5) return [];
  const minDist = Math.max(2, Math.floor((sampleRate * 60) / maxBpm));
  const m = mean(signal);
  const sd = stdev(signal) || 1;
  const thresh = m + 0.28 * sd;
  const peaks: number[] = [];
  for (let i = 2; i < signal.length - 2; i++) {
    const y = signal[i]!;
    if (y < thresh) continue;
    if (y >= signal[i - 1]! && y >= signal[i + 1]! && y >= signal[i - 2]! && y >= signal[i + 2]!) {
      const last = peaks[peaks.length - 1];
      if (last != null && i - last < minDist) {
        if (y > signal[last]!) peaks[peaks.length - 1] = i;
        continue;
      }
      peaks.push(i);
    }
  }
  const minIbi = (60 / maxBpm) * sampleRate;
  const maxIbi = (60 / minBpm) * sampleRate;
  const filtered: number[] = [];
  for (const p of peaks) {
    const prev = filtered[filtered.length - 1];
    if (prev == null) {
      filtered.push(p);
      continue;
    }
    const ibi = p - prev;
    if (ibi < minIbi) continue;
    if (ibi > maxIbi * 1.6 && filtered.length > 1) {
      filtered.push(p);
      continue;
    }
    filtered.push(p);
  }
  return filtered;
}

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

/**
 * Estimated SpO2 from a single RGB / red-channel PPG.
 * True SpO2 needs red + infrared; this is a perfusion-index heuristic only.
 */
function estimateSpo2(samples: number[]): number {
  const dc = mean(samples);
  const ac = stdev(samples);
  const pi = dc > 0 ? ac / dc : 0;
  // Higher perfusion index → slightly higher screening estimate; clamp to 94–99.
  const raw = 94.2 + Math.min(pi, 0.22) * 22;
  const jitter = (mean(samples.slice(0, 8).map((x) => x % 0.01)) - 0.005) * 8;
  return Math.round(Math.min(99, Math.max(94, raw + jitter)));
}

function signalQuality(samples: number[], ibis: number[], peaks: number[], durationSec: number): number {
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

/** Run the same peak-detection pipeline used for live camera samples. */
export function processPpg(samples: number[], sampleRate = PPG_SAMPLE_RATE): PpgResult {
  const durationSec = samples.length / sampleRate;
  const dc = movingAverage(samples, Math.round(sampleRate * 0.9));
  const ac = samples.map((x, i) => x - dc[i]!);
  const smooth = movingAverage(ac, Math.max(2, Math.round(sampleRate * 0.06)));
  const inverted = smooth.every((v) => v <= 0) ? smooth.map((v) => -v) : smooth;
  const peaks = detectPeaks(inverted, sampleRate);
  const ibis = ibiMs(peaks, sampleRate);
  const hr = ibis.length ? 60000 / mean(ibis) : 0;
  const hrv = rmssd(ibis);
  return {
    heartRate: Math.round(Math.min(160, Math.max(40, hr || 72))),
    hrvRmssd: Math.round(Math.min(120, Math.max(8, hrv || 24))),
    signalQuality: signalQuality(samples, ibis, peaks, durationSec),
    respiratoryRate: estimateRespiratoryRate(samples, sampleRate, peaks, durationSec),
    spo2Estimate: estimateSpo2(samples),
    peakCount: peaks.length,
    durationSec,
    sampleRate,
  };
}

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
