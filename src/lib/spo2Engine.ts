/**
 * Pure fingertip SpO₂ signal-processing pipeline.
 * No DOM, React, or camera side effects.
 *
 * The camera supplies red/green ROI means while the rear-camera torch is on.
 * Both channels are filtered in the pulse band, then the ratio-of-ratios
 * estimate is accepted only when there is enough usable contact and pulsatile
 * signal. A rejected sample is always null; this module never invents a
 * number.
 */

export type Spo2Quality = "good" | "weak" | "reject" | "manual";

export interface Spo2Analysis {
  spo2: number | null;
  quality: Exclude<Spo2Quality, "manual">;
  peakCount: number;
  acRed: number;
  acGreen: number;
}

export const SPO2_MIN_HZ = 0.7;
export const SPO2_MAX_HZ = 4;
export const SPO2_MIN_USABLE_SECONDS = 15;
export const SPO2_MIN_PEAKS = 5;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let total = 0;
  for (const x of xs) total += x;
  return total / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function highpass(input: number[], fs: number, cutoffHz: number): number[] {
  const output = new Array<number>(input.length);
  if (input.length === 0) return output;
  const dt = 1 / fs;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = rc / (rc + dt);
  let previousInput = input[0];
  let previousOutput = 0;
  output[0] = 0;
  for (let i = 1; i < input.length; i++) {
    previousOutput = alpha * (previousOutput + input[i] - previousInput);
    previousInput = input[i];
    output[i] = previousOutput;
  }
  return output;
}

function lowpass(input: number[], fs: number, cutoffHz: number): number[] {
  const output = new Array<number>(input.length);
  if (input.length === 0) return output;
  const dt = 1 / fs;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);
  output[0] = input[0];
  for (let i = 1; i < input.length; i++) {
    output[i] = output[i - 1] + alpha * (input[i] - output[i - 1]);
  }
  return output;
}

/** Cascaded single-pole IIR bandpass, matching the face-pulse filter style. */
export function bandpassSpo2(input: number[], fs: number): number[] {
  return lowpass(
    lowpass(
      highpass(highpass(input, fs, SPO2_MIN_HZ), fs, SPO2_MIN_HZ),
      fs,
      SPO2_MAX_HZ,
    ),
    fs,
    SPO2_MAX_HZ,
  );
}

/**
 * Contact gate for a fingertip illuminated by the rear-camera torch.
 * Red dominance rejects an uncovered lens and most background scenes.
 */
export function isFingerContact(red: number, green: number, blue: number): boolean {
  const luma = 0.299 * red + 0.587 * green + 0.114 * blue;
  return red > 120 && red / Math.max(green + blue, 1) > 1.4 && luma > 60;
}

function robustAcAmplitude(filtered: number[]): number {
  return 1.4826 * median(filtered.map((value) => Math.abs(value)));
}

function detectPulsatilePeaks(signal: number[], fs: number): number[] {
  if (signal.length < 10) return [];
  const centered = signal.map((value) => value - mean(signal));
  const threshold = 0.35 * Math.sqrt(mean(centered.map((value) => value * value)));
  const halfWindow = Math.max(1, Math.round(fs * 0.12));
  const minimumDistance = Math.max(1, Math.round(fs * 0.25));
  const peaks: number[] = [];

  for (let i = halfWindow; i < centered.length - halfWindow; i++) {
    if (centered[i] < threshold) continue;
    let localMaximum = true;
    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (centered[j] > centered[i]) {
        localMaximum = false;
        break;
      }
    }
    if (!localMaximum) continue;
    const previous = peaks[peaks.length - 1];
    if (previous === undefined || i - previous >= minimumDistance) peaks.push(i);
    else if (centered[i] > centered[previous]) peaks[peaks.length - 1] = i;
  }
  return peaks;
}

function rejected(peakCount = 0, acRed = 0, acGreen = 0): Spo2Analysis {
  return { spo2: null, quality: "reject", peakCount, acRed, acGreen };
}

/**
 * Analyze a uniform red/green series. `fs` is the effective sample rate in Hz.
 * At least 15 seconds of usable contact is required before an estimate can be
 * returned.
 */
export function analyzeSpo2(redSeries: number[], greenSeries: number[], fs: number): Spo2Analysis {
  const length = Math.min(redSeries.length, greenSeries.length);
  if (length === 0 || !Number.isFinite(fs) || fs < 15 || length / fs < SPO2_MIN_USABLE_SECONDS) {
    return rejected();
  }

  const red = redSeries.slice(0, length);
  const green = greenSeries.slice(0, length);
  const filteredRed = bandpassSpo2(red, fs);
  const filteredGreen = bandpassSpo2(green, fs);
  const settle = Math.min(Math.floor(fs * 0.5), Math.max(0, length - 12));
  const redPulse = filteredRed.slice(settle);
  const greenPulse = filteredGreen.slice(settle);
  const acRed = robustAcAmplitude(redPulse);
  const acGreen = robustAcAmplitude(greenPulse);
  const dcRed = mean(red);
  const dcGreen = mean(green);
  const peakCount = detectPulsatilePeaks(redPulse, fs).length;

  if (
    dcRed <= 0 ||
    dcGreen <= 0 ||
    acRed < 0.05 ||
    acGreen < 0.05 ||
    peakCount < SPO2_MIN_PEAKS
  ) {
    return rejected(peakCount, acRed, acGreen);
  }

  const ratio = (acRed / dcRed) / (acGreen / dcGreen);
  if (!Number.isFinite(ratio) || ratio <= 0) return rejected(peakCount, acRed, acGreen);

  return {
    spo2: Math.round(clamp(110 - 25 * ratio, 70, 100)),
    quality: peakCount >= 8 ? "good" : "weak",
    peakCount,
    acRed,
    acGreen,
  };
}

/** Convenience API for callers that only need the accepted number. */
export function estimateSpo2(redSeries: number[], greenSeries: number[], fs: number): number | null {
  return analyzeSpo2(redSeries, greenSeries, fs).spo2;
}

/** Values suitable for a live red-channel waveform canvas. */
export function spo2Waveform(redSeries: number[], windowSize: number): number[] {
  if (redSeries.length < 2) return [];
  return redSeries.slice(Math.max(0, redSeries.length - windowSize));
}