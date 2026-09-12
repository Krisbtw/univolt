/**
 * Pure rPPG (remote photoplethysmography) signal-processing pipeline.
 * No DOM, no React, no side effects.
 *
 * Face ROI RGB means → CHROM chrominance → bandpass 0.7–3.0 Hz
 * → Goertzel FFT dominant frequency + time-domain peak detection → BPM.
 * Every reading passes an SNR + peak-count quality gate; when the signal
 * is poor the engine returns bpm = null ("Unable to detect"), never an
 * invented number.
 */

export interface RppgSample {
    tMs: number;
    r: number;
    g: number;
    b: number;
}

export interface VitalsMetrics {
    bpm: number | null;
    hrv: number | null;
    spo2: number | null;
    rr: number | null;
}

export type RppgQuality = "good" | "weak" | "reject";

export interface RppgAnalysis extends VitalsMetrics {
    snrDb: number;
    quality: RppgQuality;
    confidence: number;
}

// ---- tunables ----
export const PULSE_MIN_HZ = 0.7; // 42 bpm floor
export const PULSE_MAX_HZ = 3.0; // 180 bpm ceiling
export const SNR_ACCEPT_DB = 2.0; // spectral peak must beat the noise floor by ≥ ~1.6×
export const SNR_STRONG_DB = 5.0;
export const MIN_PEAKS = 8; // ≥ 8 beats in the window
export const MIN_SAMPLE_COUNT = 240; // ~8 s @ 30 fps before anything is reported
export const MIN_FS = 15; // effective sample-rate floor
const PEAK_AGREEMENT_BPM = 10; // FFT vs time-domain agreement window

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

/** Cardiac band 0.7–3.0 Hz (steep skirt via double HP + double LP). */
export function bandpassPulse(x: number[], fs: number): number[] {
    return lowpass(
        lowpass(highpass(highpass(x, fs, PULSE_MIN_HZ), fs, PULSE_MIN_HZ), fs, PULSE_MAX_HZ),
        fs,
        PULSE_MAX_HZ,
    );
}
/** Respiration band 0.13–0.4 Hz. */
export function bandpassRespiration(x: number[], fs: number): number[] {
    return lowpass(lowpass(highpass(x, fs, 0.13), fs, 0.4), fs, 0.4);
}

// ---------- CHROM chrominance (de Haan & Jeanne, 2013) ----------
/** X = 3R − 2G, Y = 1.5R + G − 1.5B, S = Xn − (σX/σY)·Yn */
export function chrominanceSignal(r: number[], g: number[], b: number[]): number[] {
    const n = Math.min(r.length, g.length, b.length);
    if (n === 0) return [];
    const X = new Array<number>(n);
    const Y = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        X[i] = 3 * r[i] - 2 * g[i];
        Y[i] = 1.5 * r[i] + g[i] - 1.5 * b[i];
    }
    const meanX = mean(X);
    const meanY = mean(Y);
    if (Math.abs(meanX) < 1e-9 || Math.abs(meanY) < 1e-9) return [];
    const Xn = X.map((v) => v / meanX);
    const Yn = Y.map((v) => v / meanY);
    const sdX = stdev(Xn);
    const sdY = stdev(Yn);
    if (sdY < 1e-9) return [];
    const alpha = sdX / sdY;
    return Xn.map((v, i) => v - alpha * Yn[i]);
}

// ---------- uniform resampling (jittery rAF timestamps → fixed grid) ----------
interface UniformSeries {
    r: number[];
    g: number[];
    b: number[];
    fs: number;
}
function toUniformSeries(samples: RppgSample[]): UniformSeries {
    const n = samples.length;
    if (n < 2) return { r: [], g: [], b: [], fs: 0 };
    const t0 = samples[0].tMs;
    const span = samples[n - 1].tMs - t0;
    if (span <= 0) return { r: [], g: [], b: [], fs: 0 };
    const fs = ((n - 1) * 1000) / span;
    const r = new Array<number>(n);
    const g = new Array<number>(n);
    const b = new Array<number>(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
        const target = (i * 1000) / fs;
        while (j < n - 1 && samples[j + 1].tMs - t0 < target) j++;
        const a = samples[j];
        const bb = samples[Math.min(j + 1, n - 1)];
        const ta = a.tMs - t0;
        const tb = bb.tMs - t0;
        const spanAb = tb - ta;
        const w = spanAb > 0 ? clamp((target - ta) / spanAb, 0, 1) : 0;
        r[i] = a.r + (bb.r - a.r) * w;
        g[i] = a.g + (bb.g - a.g) * w;
        b[i] = a.b + (bb.b - a.b) * w;
    }
    return { r, g, b, fs };
}

// ---------- Goertzel power at a single frequency ----------
function goertzelPower(x: number[], fs: number, f: number): number {
    const n = x.length;
    if (n === 0) return 0;
    const omega = (2 * Math.PI * f) / fs;
    const coeff = 2 * Math.cos(omega);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
        const s0 = x[i] + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
    }
    return Math.max(s1 * s1 + s2 * s2 - coeff * s1 * s2, 0);
}

/** Dominant pulse frequency + spectral SNR (peak vs. surrounding noise floor). */
export function estimatePulseFft(
    signal: number[],
    fs: number,
): { freqHz: number; snrDb: number } | null {
    const n = signal.length;
    if (n < 60) return null;
    const step = Math.max(fs / n, 0.02); // ≤ 0.02 Hz grid, at least bin resolution
    const freqs: number[] = [];
    const powers: number[] = [];
    for (let f = PULSE_MIN_HZ; f <= PULSE_MAX_HZ; f += step) {
        freqs.push(f);
        powers.push(goertzelPower(signal, fs, f));
    }
    if (freqs.length < 3) return null;
    let bestIdx = 0;
    for (let i = 1; i < powers.length; i++) {
        if (powers[i] > powers[bestIdx]) bestIdx = i;
    }
    const peakFreq = freqs[bestIdx];
    const peakPower = powers[bestIdx];
    // Noise floor = mean power outside ±0.25 Hz of the peak.
    let noiseSum = 0;
    let noiseCount = 0;
    for (let i = 0; i < freqs.length; i++) {
        if (Math.abs(freqs[i] - peakFreq) <= 0.25) continue;
        noiseSum += powers[i];
        noiseCount += 1;
    }
    const noiseMean = noiseCount > 0 ? noiseSum / noiseCount : 0;
    if (noiseMean <= 1e-12) return null;
    const snrDb = 10 * Math.log10(peakPower / noiseMean);
    return { freqHz: peakFreq, snrDb };
}

// ---------- time-domain peak detection ----------
export function detectPeaks(x: number[], fs: number): number[] {
    const n = x.length;
    if (n < 10) return [];
    const m = mean(x);
    const sd = stdev(x);
    if (sd < 1e-9) return [];
    const threshold = m + 0.4 * sd;
    const half = Math.max(1, Math.round(fs * 0.12)); // ±120 ms local-max window
    const minDist = Math.max(1, Math.round(fs * 0.3)); // ≥300 ms between beats
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

// ---------- respiratory rate (autocorrelation on the respiration band) ----------
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

// ---------- live waveform (for the canvas) ----------
export function liveWaveform(samples: RppgSample[], windowMs: number): number[] {
    if (samples.length < 60) return [];
    const lastT = samples[samples.length - 1].tMs;
    const start = lastT - windowMs;
    const win: RppgSample[] = [];
    for (const s of samples) if (s.tMs >= start) win.push(s);
    if (win.length < 60) return [];
    const u = toUniformSeries(win);
    if (u.fs < MIN_FS) return [];
    const chrom = chrominanceSignal(u.r, u.g, u.b);
    if (chrom.length === 0) return [];
    const filtered = bandpassPulse(chrom, u.fs);
    const settle = Math.min(Math.floor(u.fs * 0.5), Math.max(0, filtered.length - 12));
    return filtered.slice(settle);
}

// ---------- entry point ----------
export function analyzeRppg(samples: RppgSample[]): RppgAnalysis {
    const empty: VitalsMetrics = { bpm: null, hrv: null, spo2: null, rr: null };
    if (samples.length < MIN_SAMPLE_COUNT) {
        return { ...empty, snrDb: 0, quality: "reject", confidence: 0 };
    }
    const u = toUniformSeries(samples);
    if (u.fs < MIN_FS || u.r.length < MIN_SAMPLE_COUNT / 2) {
        return { ...empty, snrDb: 0, quality: "reject", confidence: 0 };
    }
    const chrom = chrominanceSignal(u.r, u.g, u.b);
    if (chrom.length === 0) return { ...empty, snrDb: 0, quality: "reject", confidence: 0 };
    const filtered = bandpassPulse(chrom, u.fs);
    // Trim the filter transient (~0.5 s).
    const settle = Math.min(Math.floor(u.fs * 0.5), Math.max(0, filtered.length - 12));
    const pulseSignal = filtered.slice(settle);

    const fft = estimatePulseFft(pulseSignal, u.fs);
    const peaks = detectPeaks(pulseSignal, u.fs);
    const { bpm: peakBpm, hrv } = computeBpmAndHrv(peaks, u.fs);
    const rr = estimateRespiratoryRate(chrom, u.fs);
    const snrDb = fft !== null ? fft.snrDb : -99;

    // ---- acceptance gate: refuse to invent a number ----
    const enoughPeaks = peaks.length >= MIN_PEAKS;
    let bpm: number | null = null;
    let quality: RppgQuality = "reject";
    if (fft !== null && fft.snrDb >= SNR_ACCEPT_DB && enoughPeaks) {
        const fftBpm = fft.freqHz * 60;
        const agree = peakBpm !== null && Math.abs(peakBpm - fftBpm) <= PEAK_AGREEMENT_BPM;
        if (agree || fft.snrDb >= SNR_STRONG_DB) {
            bpm = Math.round(clamp(fftBpm, 42, 180));
            quality = fft.snrDb >= SNR_STRONG_DB ? "good" : "weak";
        }
    } else if (fft !== null && fft.snrDb >= SNR_STRONG_DB && peakBpm !== null && enoughPeaks) {
        // FFT frequency grid edge case, but the time domain is unambiguous.
        bpm = peakBpm;
        quality = "weak";
    }
    const confidence = bpm === null ? 0 : clamp(0.5 + snrDb / 12, 0, 1);
    return {
        bpm,
        hrv: bpm === null ? null : hrv,
        spo2: null, // face rPPG cannot measure SpO₂ reliably — never fake it
        rr: bpm === null ? null : rr,
        snrDb,
        quality,
        confidence,
    };
}