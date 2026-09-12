import type { CoughResult } from "./types";

export const COUGH_DURATION_SEC = 6;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return s / (xs.length - 1);
}

/**
 * Prototype acoustic heuristic — not a trained diagnostic classifier.
 * Uses zero-crossing rate + short-time energy variance on a PCM buffer.
 */
export function analyzeCoughPcm(samples: Float32Array | number[], sampleRate: number): CoughResult {
  const n = samples.length;
  const durationSec = n / sampleRate || COUGH_DURATION_SEC;
  if (n < sampleRate * 0.4) {
    return {
      classification: "Normal",
      zeroCrossingRate: 0,
      energyVariance: 0,
      durationSec,
      simulated: false,
      notes: "Sample too short for heuristic.",
    };
  }

  let crossings = 0;
  for (let i = 1; i < n; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) crossings += 1;
  }
  const zeroCrossingRate = crossings / durationSec;

  const frame = Math.max(32, Math.floor(0.03 * sampleRate));
  const hop = Math.max(16, Math.floor(frame / 2));
  const energies: number[] = [];
  for (let i = 0; i + frame < n; i += hop) {
    let e = 0;
    for (let j = 0; j < frame; j++) {
      const v = samples[i + j]!;
      e += v * v;
    }
    energies.push(e / frame);
  }
  const energyVariance = variance(energies);
  const energyMean = mean(energies);
  const burstiness = energyVariance / (energyMean + 1e-8);

  // Bursty, high-ZCR captures look more like cough trains / irregular breathing.
  const irregular = burstiness > 2.4 && zeroCrossingRate > 280 && energyMean > 0.0004;
  return {
    classification: irregular
      ? "Possible irregular breathing pattern — refer for clinical follow-up"
      : "Normal",
    zeroCrossingRate: Math.round(zeroCrossingRate),
    energyVariance: Number(energyVariance.toExponential(2) === "0.0e+0" ? energyVariance : energyVariance),
    durationSec,
    simulated: false,
    notes: irregular
      ? "High short-time energy variance with elevated zero-crossing rate."
      : "Energy envelope within the quiet-breathing band of this prototype.",
  };
}

/** Evenly-strided downsample so long real-mic buffers stay cheap to draw as a trace. */
export function downsampleTrace(samples: ArrayLike<number>, target = 1200): number[] {
  const n = samples.length;
  if (n <= target) return Array.from(samples);
  const stride = Math.max(1, Math.floor(n / target));
  const out: number[] = [];
  for (let i = 0; i < n; i += stride) out.push(samples[i]!);
  return out;
}

/** Canned mock used when the microphone API is missing or permission is denied. */
export function generateMockCoughResult(kind: "normal" | "irregular" = "normal"): {
  samples: number[];
  result: CoughResult;
} {
  const sampleRate = 4000;
  const n = sampleRate * COUGH_DURATION_SEC;
  const samples = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const breath = 0.04 * Math.sin(2 * Math.PI * 0.35 * t);
    let burst = 0;
    if (kind === "irregular") {
      const cycle = t % 1.15;
      if (cycle < 0.09) {
        burst = 0.55 * Math.sin(2 * Math.PI * 380 * t) * (1 - cycle / 0.09);
      }
    }
    samples[i] = breath + burst + (Math.random() - 0.5) * 0.012;
  }
  const result = analyzeCoughPcm(samples, sampleRate);
  result.simulated = true;
  result.notes =
    kind === "irregular"
      ? "Demo audio (microphone unavailable). Prototype heuristic flagged a bursty envelope."
      : "Demo audio (microphone unavailable). Prototype heuristic classified as normal.";
  if (kind === "irregular") {
    result.classification = "Possible irregular breathing pattern — refer for clinical follow-up";
  } else {
    result.classification = "Normal";
  }
  return { samples, result };
}

export async function recordCoughAudio(
  durationSec = COUGH_DURATION_SEC,
  onLevel?: (rms: number) => void,
): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }
  let stream: MediaStream;
  try {
    stream = await Promise.race([
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      }),
      new Promise<MediaStream>((_, reject) => {
        window.setTimeout(() => reject(new Error("mic-timeout")), 1800);
      }),
    ]);
  } catch {
    return null;
  }

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (ev) => {
    const input = ev.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    if (onLevel) {
      let e = 0;
      for (let i = 0; i < input.length; i++) e += input[i]! * input[i]!;
      onLevel(Math.sqrt(e / input.length));
    }
  };

  source.connect(processor);
  processor.connect(silent);
  silent.connect(ctx.destination);

  await new Promise((resolve) => window.setTimeout(resolve, durationSec * 1000));

  processor.disconnect();
  source.disconnect();
  silent.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  const sampleRate = ctx.sampleRate || 44100;
  await ctx.close().catch(() => undefined);

  let total = 0;
  for (const c of chunks) total += c.length;
  const samples = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    samples.set(c, o);
    o += c.length;
  }
  return { samples, sampleRate };
}
