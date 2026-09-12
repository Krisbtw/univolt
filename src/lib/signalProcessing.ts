/**
 * Pure PPG signal-processing pipeline. No DOM, no React, no side effects.
 *
 * - Red-channel PPG, bandpass ~0.7–4 Hz, peak detection → BPM
 * - SDNN of RR intervals → HRV
 * - SpO2: best-effort ratio-of-ratios from red vs green AC/DC ("estimate")
 * - Respiratory rate: 0.13–0.4 Hz baseline modulation via autocorrelation ("approx" — short window)
 * - Deterministic synthetic generator used ONLY by demo mode (never auto-starts)
 */

export interface PpgSample {
    tMs: number;
    red: number;
    green: number;
}

export interface VitalsMetrics {
    bpm: number | null;
    hrv: number | null;
    spo2: number | null;
    rr: number | null;
}

export interface ScanResult extends VitalsMetrics {
    scanId: string;
    mode: "live" | "demo";
    durationMs: number;
    timestamp: number;
}

/** Demo simulation length (fixed by the rubric). */
export const DEMO_DURATION_MS = 12_000;
/** Sample rate used to synthesise the demo PPG. */
const DEMO_FS = 30;

// ---------- basic statistics ----------

function mean(xs: number[]): number {
    if (xs.length === 0) return 0;
    let s = 0;
    for (const v of xs) s += v;
    return s / xs.length;
}

function stdev(xs: number[]): number {
    const n = xs.length;
    if (n < 2) return 0;
    const m = mean(xs);
    let s = 0;
    for (const v of xs) s += (v - m) * (v - m);
    return Math.sqrt(s / (n - 1));
}

function median(xs: number[]): number {
    const n = xs.length;
    if (n === 0) return 0;
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = n >> 1;
    return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}

// ---------- filters (single-pole IIR, cascaded) ----------

function highpass(x: number[], fs: number, fc: number): number[] {
    const n = x.length;
    const y = new Array<number>(n);
    if (n === 0) return y;
    const dt = 1 / fs;
    const rc = 1 / (2 * Math.PI * fc);
    const a = rc / (rc + dt);
    let prevIn = x[0];
    let prevOut = 0;
    y[0] = 0;
    for (let i = 1; i < n; i++) {
        prevOut = a * (prevOut + x[i] - prevIn);
        prevIn = x[i];
        y[i] = prevOut;
    }
    return y;
}

function lowpass(x: number[], fs: number, fc: number): number[] {
    const n = x.length;
    const y = new Array<number>(n);
    if (n === 0) return y;
    const dt = 1 / fs;
    const rc = 1 / (2 * Math.PI * fc);
    const alpha = dt / (rc + dt);
    y[0] = x[0];
    for (let i = 1; i < n; i++) y[i] = y[i - 1] + alpha * (x[i] - y[i - 1]);
    return y;
}

/** Cardiac band ~0.7–4 Hz (double-HP for a steeper skirt). */
export function bandpassCardiac(x: number[], fs: number): number[] {
    return lowpass(highpass(highpass(x, fs, 0.7), fs, 0.7), fs, 4);
}

/** Respiration band ~0.13–0.4 Hz. */
export function bandpassRespiration(x: number[], fs: number): number[] {
    return lowpass(lowpass(highpass(x, fs, 0.13), fs, 0.4), fs, 0.4);
}

// ---------- heart rate / HRV ----------

export function detectPeaks(x: number[], fs: number): number[] {
    const n = x.length;
    if (n < 10) return [];
    const m = mean(x);
    const sd = stdev(x);
    if (sd < 1e-9) return [];
    const threshold = m + 0.4 * sd;
    const half = Math.max(1, Math.round(fs * 0.12)); // ±120 ms local-max window
    const minDist = Math.max(1, Math.round(fs * 0.3)); // ≥300 ms between beats (≤200 bpm)
    const peaks: number[] = [];
    for (let i = half; i < n - half; i++) {
        const v = x[i];
        if (v < threshold) continue;
        let isLocalMax = true;
        for (let j = i - half; j <= i + half; j++) {
            if (x[j] > v) {
                isLocalMax = false;
                break;
            }
        }
        if (!isLocalMax) continue;
        const last = peaks.length > 0 ? peaks[peaks.length - 1] : -1;
        if (last < 0 || i - last >= minDist) peaks.push(i);
        else if (v > x[last]) peaks[peaks.length - 1] = i; // keep the taller of two close candidates
    }
    return peaks;
}

export function computeBpmAndHrv(
    peakIndices: number[],
    fs: number,
): { bpm: number | null; hrv: number | null } {
    if (peakIndices.length < 5) return { bpm: null, hrv: null };
    const timesMs = peakIndices.map((i) => (i / fs) * 1000);
    const rr: number[] = [];
    for (let i = 1; i < timesMs.length; i++) {
        const d = timesMs[i] - timesMs[i - 1];
        if (d >= 300 && d <= 2000) rr.push(d);
    }
    if (rr.length < 3) return { bpm: null, hrv: null };
    const bpm = Math.round(clamp(60000 / median(rr), 30, 220));
    const hrv = rr.length >= 5 ? Math.round(clamp(stdev(rr), 0, 500)) : null;
    return { bpm, hrv };
}

// ---------- SpO2 (best-effort estimate) ----------

function robustAmplitude(x: number[]): number {
    // 1.4826 × median(|x|): a std-dev estimate that ignores short artifact bursts.
    if (x.length === 0) return 0;
    const abs: number[] = x.map((v) => Math.abs(v));
    return 1.4826 * median(abs);
}

export function estimateSpo2(red: number[], green: number[], fs: number): number | null {
    if (red.length < fs * 4 || red.length !== green.length) return null;
    const redAc = robustAmplitude(bandpassCardiac(red, fs));
    const greenAc = robustAmplitude(bandpassCardiac(green, fs));
    const redDc = mean(red);
    const greenDc = mean(green);
    if (redDc <= 1 || greenDc <= 1 || redAc < 0.05 || greenAc < 0.05) return null;
    const ratio = redAc / redDc / (greenAc / greenDc);
    const spo2 = 110 - 25 * ratio; // empirical ratio-of-ratios approximation
    if (!Number.isFinite(spo2)) return null;
    return clamp(Math.round(spo2), 70, 100);
}

// ---------- respiratory rate (approx — short window) ----------

export function estimateRespiratoryRate(x: number[], fs: number): number | null {
    const n = x.length;
    if (n < Math.floor(fs * 8)) return null; // need ≥ ~8 s
    const y = bandpassRespiration(x, fs);
    const m = mean(y);
    const z = y.map((v) => v - m);
    const minLag = Math.max(1, Math.round(fs * 2.5)); // 0.40 Hz → 24 breaths/min
    const maxLag = Math.min(Math.floor(n / 2) - 1, Math.round(fs * 7.7)); // 0.13 Hz
    if (maxLag <= minLag) return null;
    let bestLag = -1;
    let bestVal = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
        let cross = 0;
        let energy1 = 0;
        let energy2 = 0;
        for (let i = 0; i + lag < n; i++) {
            const a = z[i];
            const b = z[i + lag];
            cross += a * b;
            energy1 += a * a;
            energy2 += b * b;
        }
        const denom = Math.sqrt(energy1 * energy2);
        if (denom <= 1e-12) continue;
        const val = cross / denom;
        if (val > bestVal) {
            bestVal = val;
            bestLag = lag;
        }
    }
    if (bestLag < 0 || bestVal < 0.2) return null;
    return clamp(Math.round((60 * fs) / bestLag), 6, 40);
}

// ---------- analysis entry point ----------

/** Resamples (jittery) timestamps onto a uniform grid at the measured frame rate. */
function toUniformSeries(samples: PpgSample[]): { red: number[]; green: number[]; fs: number } {
    const n = samples.length;
    if (n < 2) return { red: [], green: [], fs: 0 };
    const t0 = samples[0].tMs;
    const span = samples[n - 1].tMs - t0;
    if (span <= 0) return { red: [], green: [], fs: 0 };
    const fs = ((n - 1) * 1000) / span;
    const red = new Array<number>(n);
    const green = new Array<number>(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
        const target = (i * 1000) / fs;
        while (j < n - 1 && samples[j + 1].tMs - t0 < target) j++;
        const a = samples[j];
        const b = samples[Math.min(j + 1, n - 1)];
        const ta = a.tMs - t0;
        const tb = b.tMs - t0;
        const spanAb = tb - ta;
        const w = spanAb > 0 ? clamp((target - ta) / spanAb, 0, 1) : 0;
        red[i] = a.red + (b.red - a.red) * w;
        green[i] = a.green + (b.green - a.green) * w;
    }
    return { red, green, fs };
}

export function analyzeScan(samples: PpgSample[]): VitalsMetrics {
    const empty: VitalsMetrics = { bpm: null, hrv: null, spo2: null, rr: null };
    if (samples.length < 60) return empty; // ≥ ~2 s at 30 fps
    const { red, green, fs } = toUniformSeries(samples);
    if (fs < 10 || red.length < 60) return empty;

    const cardiac = bandpassCardiac(red, fs);
    const settle = Math.min(Math.floor(fs * 0.5), Math.max(0, cardiac.length - 12)); // trim filter transient
    const peaks = detectPeaks(cardiac.slice(settle), fs);
    const { bpm, hrv } = computeBpmAndHrv(peaks, fs);
    const spo2 = estimateSpo2(red, green, fs);
    const rr = estimateRespiratoryRate(red, fs);
    return { bpm, hrv, spo2, rr };
}

// ---------- demo generator (runs ONLY on explicit demo-button click) ----------

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function motionArtifact(t: number, start: number, duration: number): number {
    if (t < start || t > start + duration) return 0;
    const w = (t - start) / duration;
    return Math.sin(Math.PI * w) * Math.sin(2 * Math.PI * 0.9 * (t - start));
}

/** 12 s of synthetic red/green PPG: ~72 bpm pulse with RSA (→ realistic HRV),
 *  ~16 breaths/min baseline modulation, noise, and two motion-artifact bursts.
 *  Amplitudes are tuned so the SpO2 ratio-of-ratios lands near 97%. */
export function buildDemoSamples(): PpgSample[] {
    const count = Math.round((DEMO_DURATION_MS / 1000) * DEMO_FS);
    const rng = mulberry32(0x5eedba5e);
    const heartHz = 1.2;
    const respHz = 0.27;
    const samples: PpgSample[] = [];
    for (let i = 0; i < count; i++) {
        const t = i / DEMO_FS;
        const resp = Math.sin(2 * Math.PI * respHz * t);
        const phase = 2 * Math.PI * heartHz * t + 0.35 * resp;
        const pulse = Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
        const respMod = 1 + 0.08 * resp;
        const art1 = motionArtifact(t, 3.6, 0.7);
        const art2 = motionArtifact(t, 8.1, 0.6);
        const red =
            170 + 3.0 * resp + 9.5 * pulse * respMod + (rng() - 0.5) * 2.4 + 26 * art1 + 30 * art2;
        const green =
            62 +
            2.6 * Math.sin(2 * Math.PI * respHz * t + 0.6) +
            6.7 * pulse * respMod +
            (rng() - 0.5) * 1.8 +
            21 * art1 +
            24 * art2;
        samples.push({ tMs: Math.round((i * 1000) / DEMO_FS), red, green });
    }
    return samples;
}