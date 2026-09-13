/**
 * Pure fingertip SpO₂ engine — red/green ratio-of-ratios.
 * Quality-gated: returns null rather than inventing a number.
 */
export interface Spo2Sample { tMs: number; red: number; green: number; }
export type Spo2Quality = "good" | "weak" | "reject";
export interface Spo2Result { spo2: number | null; quality: Spo2Quality; contactSec: number; }

/** Valid contact frame: red-dominant and bright — a fingertip over the LIT lens. */
export function passesContactGate(r: number, g: number, b: number): boolean {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const dominance = r / Math.max(1, g + b);
  return r > 120 && dominance > 1.4 && luma > 60;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Single-pole IIR filters (same style as the pulse engine).
function highpass(x: number[], fs: number, fc: number): number[] {
  const n = x.length; const y = new Array<number>(n);
  if (n === 0) return y;
  const dt = 1 / fs; const rc = 1 / (2 * Math.PI * fc); const a = rc / (rc + dt);
  let prevIn = x[0]; let prevOut = 0; y[0] = 0;
  for (let i = 1; i < n; i++) {
    prevOut = a * (prevOut + x[i] - prevIn);
    prevIn = x[i]; y[i] = prevOut;
  }
  return y;
}
function lowpass(x: number[], fs: number, fc: number): number[] {
  const n = x.length; const y = new Array<number>(n);
  if (n === 0) return y;
  const dt = 1 / fs; const rc = 1 / (2 * Math.PI * fc); const alpha = dt / (rc + dt);
  y[0] = x[0];
  for (let i = 1; i < n; i++) y[i] = y[i - 1] + alpha * (x[i] - y[i - 1]);
  return y;
}
function bandpassCardiac(x: number[], fs: number): number[] {
  return lowpass(lowpass(highpass(highpass(x, fs, 0.7), fs, 0.7), fs, 4), fs, 4);
}

/** Robust AC amplitude: 1.4826 × MAD — ignores short artifact bursts. */
function robustAmplitude(x: number[]): number {
  if (x.length === 0) return 0;
  return 1.4826 * median(x.map((v) => Math.abs(v)));
}

function countPeaks(x: number[], fs: number): number {
  const m = mean(x);
  const sd = Math.sqrt(mean(x.map((v) => (v - m) * (v - m))));
  if (sd < 1e-9) return 0;
  const threshold = m + 0.4 * sd;
  const minDist = Math.max(1, Math.round(fs * 0.3));
  let peaks = 0; let last = -Infinity;
  for (let i = 1; i < x.length - 1; i++) {
    if (x[i] < threshold) continue;
    if (x[i] >= x[i - 1] && x[i] > x[i + 1] && i - last >= minDist) { peaks += 1; last = i; }
  }
  return peaks;
}

/** Samples must be contact-only; tMs is accumulated CONTACT time (gaps excluded). */
export function estimateSpo2(samples: Spo2Sample[]): Spo2Result {
  if (samples.length < 90) return { spo2: null, quality: "reject", contactSec: 0 };
  const span = samples[samples.length - 1].tMs - samples[0].tMs;
  const fs = ((samples.length - 1) * 1000) / Math.max(1, span);
  const contactSec = span / 1000;
  if (fs < 10 || contactSec < 15) return { spo2: null, quality: "reject", contactSec };
  const red = samples.map((s) => s.red);
  const green = samples.map((s) => s.green);
  const redF = bandpassCardiac(red, fs);
  const greenF = bandpassCardiac(green, fs);
  const redAc = robustAmplitude(redF);
  const greenAc = robustAmplitude(greenF);
  const redDc = mean(red);
  const greenDc = mean(green);
  const peaks = countPeaks(redF, fs);
  if (redDc <= 1 || greenDc <= 1 || redAc < 0.05 || greenAc < 0.05 || peaks < 8) {
    return { spo2: null, quality: "reject", contactSec };
  }
  const ratio = (redAc / redDc) / (greenAc / greenDc);
  const spo2 = 110 - 25 * ratio;
  if (!Number.isFinite(spo2)) return { spo2: null, quality: "reject", contactSec };
  const value = clamp(Math.round(spo2), 70, 100);
  return { spo2: value, quality: peaks >= 12 ? "good" : "weak", contactSec };
}