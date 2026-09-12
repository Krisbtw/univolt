import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  PPG_DURATION_SEC,
  PPG_SAMPLE_RATE,
  detectPeaks,
  nextSimulatedSample,
  processPpg,
  processPpgWithTimestamps,
} from "@/lib/univolt/ppgProcessor";
import type { PpgResult } from "@/lib/univolt/types";

export type ScanMode = "idle" | "live" | "demo";
export type ScanPhase = "idle" | "starting" | "running" | "paused" | "processing" | "done";

export interface LivePpgState {
  mode: ScanMode;
  phase: ScanPhase;
  remaining: number;
  isContact: boolean;
  torchActive: boolean;
  error: string | null;
  result: PpgResult | null;
  rMean: number;
  dominance: number;
  /** Live BPM estimate updated every ~500 ms during an active scan (null until enough peaks). */
  liveBpm: number | null;
  /**
   * AC amplitude of the green-channel PPG signal (rolling stdev over last 30 frames).
   * Low amplitude + high red saturation indicates tissue blanching from excess pressure.
   */
  acAmplitude: number;
  /**
   * True when rMean is high (finger present & lit) but pulsatile AC amplitude is too
   * low — indicates the user is pressing so hard the capillaries are blanched shut.
   */
  blanchingWarning: boolean;
}

const TOTAL_CAPTURE_MS = PPG_DURATION_SEC * 1000;

/** Offscreen canvas render dimensions — small enough for fast pixel reads. */
const PROCESS_W = 160;
const PROCESS_H = 120;

/** Target frame rate for optical sampling (ms per frame). */
const FRAME_INTERVAL_MS = 1000 / 30; // 30 fps

/** How often we re-derive a live BPM from the collected samples. */
const BPM_COMMIT_INTERVAL_MS = 500;

/** Contact gate thresholds per the DSP specification. */
const CONTACT_R_THRESHOLD = 120;
const CONTACT_DOMINANCE_THRESHOLD = 1.4;

export function useLiveCameraPpg({
  videoRef,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [state, setState] = useState<LivePpgState>({
    mode: "idle",
    phase: "idle",
    remaining: PPG_DURATION_SEC,
    isContact: false,
    torchActive: false,
    error: null,
    result: null,
    rMean: 0,
    dominance: 0,
    liveBpm: null,
    acAmplitude: 0,
    blanchingWarning: false,
  });

  /**
   * Rolling green-channel AC amplitude (last N frames) for blanching detection.
   * We keep a short window of recent gMean values and compute stdev as the AC proxy.
   */
  const recentGreenRef = useRef<number[]>([]);

  /**
   * Green-channel mean samples — primary cardiac signal input.
   * Green (~525 nm) is at the primary absorption band of oxyhaemoglobin.
   * Red is retained solely for the finger-contact gate.
   */
  const samplesRef = useRef<number[]>([]);

  /**
   * Real `performance.now()` timestamps (ms) recorded for each accepted frame.
   * Parallel array to samplesRef — index k corresponds to the same frame.
   * Used by processPpgWithTimestamps to compute IBIs from real elapsed time,
   * eliminating BPM error caused by mobile browser frame-rate variability.
   */
  const timestampsRef = useRef<number[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeMsRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastBpmCommitRef = useRef<number>(0);
  const phaseRef = useRef<ScanPhase>("idle");
  const modeRef = useRef<ScanMode>("idle");
  const demoIntervalRef = useRef<number | null>(null);
  const demoPhaseRef = useRef({ current: Math.random() });

  // Offscreen canvas for sampling center 25 % of video.
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── camera teardown ───────────────────────────────────────────────────────
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        // Gracefully turn off torch before stopping.
        track.applyConstraints({ advanced: [{ torch: false }] as any }).catch(() => {});
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  const cleanup = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (demoIntervalRef.current != null) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    stopCameraStream();
  }, [stopCameraStream]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ── finalization ─────────────────────────────────────────────────────────
  const finalizeScan = useCallback(
    (samples: number[], rate: number, timestamps?: number[]) => {
      phaseRef.current = "processing";
      setState((prev) => ({ ...prev, phase: "processing", liveBpm: null }));
      cleanup();

      window.setTimeout(() => {
        // Live path: use real frame timestamps for accurate IBI computation.
        // Demo path: fall back to uniform-rate processPpg.
        const processed =
          timestamps && timestamps.length === samples.length
            ? processPpgWithTimestamps(samples, timestamps)
            : processPpg(samples, rate);
        phaseRef.current = "done";
        setState((prev) => ({
          ...prev,
          phase: "done",
          result: processed,
          liveBpm: processed.heartRate,
        }));
      }, 600);
    },
    [cleanup],
  );

  // ── live BPM estimator (called from processFrame) ────────────────────────
  /**
   * Rolling BPM estimate using real timestamps for the last 6 s of samples.
   * Falls back to index-based IBIs when fewer than 3 s of data are available.
   */
  const deriveLiveBpm = useCallback(
    (samples: number[], timestamps: number[]): number | null => {
      if (samples.length < 10 || timestamps.length !== samples.length) return null;

      // Take the most recent 6 s worth of frames.
      const tNow = timestamps[timestamps.length - 1]!;
      const cutoff = tNow - 6000;
      let startIdx = 0;
      for (let i = timestamps.length - 1; i >= 0; i--) {
        if (timestamps[i]! < cutoff) { startIdx = i + 1; break; }
      }
      const win = samples.slice(startIdx);
      const winTs = timestamps.slice(startIdx);
      if (win.length < 10) return null;

      // Use the timestamp-aware peak detector on the windowed signal.
      const dc = win.reduce((a, b) => a + b, 0) / win.length;
      const centered = win.map((x) => x - dc);
      const peaks = detectPeaks(centered, win.length / ((winTs[winTs.length - 1]! - winTs[0]!) / 1000 || 1));
      if (peaks.length < 3) return null;

      // Compute IBIs from real timestamps.
      const ibis: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        ibis.push(winTs[peaks[i]!]! - winTs[peaks[i - 1]!]!);
      }
      const med = ibis.slice().sort((a, b) => a - b)[Math.floor(ibis.length / 2)]!;
      return Math.round(Math.min(220, Math.max(40, 60000 / med)));
    },
    [],
  );

  // ── optical frame processing loop (live mode) ────────────────────────────
  const processFrame = useCallback(
    (now: number) => {
      if (modeRef.current !== "live") return;

      // Throttle to target frame rate.
      const dtSinceLast = now - lastFrameTimeRef.current;
      if (dtSinceLast < FRAME_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }
      const dt = Math.min(dtSinceLast, 100); // clamp for tab-switch spikes
      lastFrameTimeRef.current = now;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Lazy-create the offscreen canvas.
      if (!offscreenCanvasRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = PROCESS_W;
        canvas.height = PROCESS_H;
        offscreenCanvasRef.current = canvas;
      }

      const canvas = offscreenCanvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Render video frame onto offscreen canvas.
      ctx.drawImage(video, 0, 0, PROCESS_W, PROCESS_H);

      // Center 25 % Region of Interest (middle quarter of width × height).
      const x0 = Math.floor(PROCESS_W / 4);
      const x1 = PROCESS_W - x0;
      const y0 = Math.floor(PROCESS_H / 4);
      const y1 = PROCESS_H - y0;
      const roiW = x1 - x0;
      const roiH = y1 - y0;

      let imgData: ImageData;
      try {
        imgData = ctx.getImageData(x0, y0, roiW, roiH);
      } catch {
        // Cross-origin or context loss — skip frame.
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Compute per-channel means over the ROI.
      const data = imgData.data;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      const pixelCount = roiW * roiH;

      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i]!;
        gSum += data[i + 1]!;
        bSum += data[i + 2]!;
      }

      const rMean = rSum / pixelCount;
      const gMean = gSum / pixelCount;
      const bMean = bSum / pixelCount;
      const dominance = rMean / (gMean + bMean + 1);

      // Finger Contact & Alignment Gate — red channel + dominance ratio only.
      const isContact = rMean > CONTACT_R_THRESHOLD && dominance > CONTACT_DOMINANCE_THRESHOLD;

      // Rolling green-channel window for AC amplitude (blanching detection).
      // Keep the last 30 samples (~1 s at 30 fps).
      recentGreenRef.current.push(gMean);
      if (recentGreenRef.current.length > 30) recentGreenRef.current.shift();
      const recentG = recentGreenRef.current;
      const gAcAmplitude =
        recentG.length > 4
          ? (() => {
              const gMeanMean = recentG.reduce((a, b) => a + b, 0) / recentG.length;
              return Math.sqrt(
                recentG.reduce((a, b) => a + (b - gMeanMean) ** 2, 0) / recentG.length,
              );
            })()
          : 0;

      /**
       * Blanching warning: finger is present and lit (high rMean) but the
       * green-channel pulsatile AC amplitude is too low — capillaries blanched
       * shut by excess pressure.
       * Thresholds: rMean > 160 (well-lit red), gAcAmplitude < 1.5 (weak pulse).
       */
      const blanchingWarning =
        isContact && rMean > 160 && gAcAmplitude < 1.5 && recentG.length > 10;

      if (isContact) {
        // Advance timer and collect GREEN channel sample + real timestamp.
        activeMsRef.current += dt;
        samplesRef.current.push(gMean);       // ← green channel for cardiac signal
        timestampsRef.current.push(now);      // ← real performance.now() ms

        const left = Math.max(0, Math.ceil((TOTAL_CAPTURE_MS - activeMsRef.current) / 1000));

        if (phaseRef.current !== "running") {
          phaseRef.current = "running";
        }

        // Rolling BPM estimate using real timestamps, committed every 500 ms.
        let liveBpm: number | null = null;
        if (now - lastBpmCommitRef.current >= BPM_COMMIT_INTERVAL_MS) {
          lastBpmCommitRef.current = now;
          liveBpm = deriveLiveBpm(samplesRef.current, timestampsRef.current);
        }

        setState((prev) => ({
          ...prev,
          phase: "running",
          isContact: true,
          remaining: left,
          rMean,
          dominance,
          acAmplitude: gAcAmplitude,
          blanchingWarning,
          ...(liveBpm !== null ? { liveBpm } : {}),
        }));

        if (activeMsRef.current >= TOTAL_CAPTURE_MS) {
          // Pass real timestamps to the finalization pipeline.
          finalizeScan(samplesRef.current.slice(), 30, timestampsRef.current.slice());
          return;
        }
      } else {
        // Finger removed — pause the timer (keep accumulated progress).
        if (phaseRef.current === "running") {
          phaseRef.current = "paused";
        }
        setState((prev) => ({
          ...prev,
          phase: activeMsRef.current > 0 ? "paused" : prev.phase,
          isContact: false,
          rMean,
          dominance,
          acAmplitude: gAcAmplitude,
          blanchingWarning: false, // no warning when no contact
        }));
      }

      rafRef.current = requestAnimationFrame(processFrame);
    },
    [finalizeScan, videoRef, deriveLiveBpm],
  );

  // ── start live camera scan ───────────────────────────────────────────────
  const startLiveScan = useCallback(async () => {
    cleanup();
    samplesRef.current = [];
    timestampsRef.current = [];
    activeMsRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastBpmCommitRef.current = 0;
    modeRef.current = "live";
    phaseRef.current = "starting";

    recentGreenRef.current = [];
    setState({
      mode: "live",
      phase: "starting",
      remaining: PPG_DURATION_SEC,
      isContact: false,
      torchActive: false,
      error: null,
      result: null,
      rMean: 0,
      dominance: 0,
      liveBpm: null,
      acAmplitude: 0,
      blanchingWarning: false,
    });

    try {
      // 1. Real-Time Camera Hardware Ingestion — rear camera + torch.
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
          advanced: [{ torch: true }] as any,
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // 2. Attempt torch activation with graceful silent fallback.
      let torchSuccess = false;
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.applyConstraints === "function") {
        try {
          await track.applyConstraints({ advanced: [{ torch: true }] as any });
          torchSuccess = true;
        } catch {
          // Torch unsupported (desktop / browser) — silent fallback.
          torchSuccess = false;
        }
      }

      // Stay in "starting" phase — contact gate will advance to "running".
      setState((prev) => ({
        ...prev,
        torchActive: torchSuccess,
      }));

      lastFrameTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(processFrame);
    } catch (err: any) {
      console.error("[useLiveCameraPpg] camera access error:", err);
      phaseRef.current = "idle";
      modeRef.current = "idle";
      setState((prev) => ({
        ...prev,
        mode: "idle",
        phase: "idle",
        error:
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Camera permission denied. Enable camera access in your browser settings and try again."
            : "Camera unavailable or unsupported on this device. Use the demo signal instead.",
      }));
    }
  }, [cleanup, processFrame, videoRef]);

  // ── demo scan (simulated fingertip PPG) ─────────────────────────────────
  const startDemoScan = useCallback(() => {
    cleanup();
    samplesRef.current = [];
    timestampsRef.current = [];
    demoPhaseRef.current.current = Math.random();
    modeRef.current = "demo";
    phaseRef.current = "running";

    setState({
      mode: "demo",
      phase: "running",
      remaining: PPG_DURATION_SEC,
      isContact: true,
      torchActive: false,
      error: null,
      result: null,
      rMean: 180,
      dominance: 2.1,
      liveBpm: null,
      acAmplitude: 0,
      blanchingWarning: false,
    });

    const bpm = 68 + Math.random() * 24;
    const rrBpm = 12 + Math.random() * 8;
    const started = performance.now();
    const dt = 1 / PPG_SAMPLE_RATE;

    demoIntervalRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      const targetCount = Math.min(
        PPG_DURATION_SEC * PPG_SAMPLE_RATE,
        Math.floor(elapsed * PPG_SAMPLE_RATE) + 1,
      );

      while (samplesRef.current.length < targetCount) {
        const t = samplesRef.current.length * dt;
        samplesRef.current.push(
          nextSimulatedSample(t, bpm, rrBpm, demoPhaseRef.current, dt),
        );
      }

      const left = Math.max(0, Math.ceil(PPG_DURATION_SEC - elapsed));
      setState((prev) => ({ ...prev, remaining: left }));

      if (elapsed >= PPG_DURATION_SEC) {
        if (demoIntervalRef.current != null) {
          window.clearInterval(demoIntervalRef.current);
          demoIntervalRef.current = null;
        }
        finalizeScan(samplesRef.current.slice(), PPG_SAMPLE_RATE);
      }
    }, 40);
  }, [cleanup, finalizeScan]);

  // ── reset ────────────────────────────────────────────────────────────────
  const resetScan = useCallback(() => {
    cleanup();
    samplesRef.current = [];
    timestampsRef.current = [];
    activeMsRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastBpmCommitRef.current = 0;
    phaseRef.current = "idle";
    modeRef.current = "idle";
    recentGreenRef.current = [];
    setState({
      mode: "idle",
      phase: "idle",
      remaining: PPG_DURATION_SEC,
      isContact: false,
      torchActive: false,
      error: null,
      result: null,
      rMean: 0,
      dominance: 0,
      liveBpm: null,
      acAmplitude: 0,
      blanchingWarning: false,
    });
  }, [cleanup]);

  return {
    state,
    /** Expose raw red-channel samples so callers can feed WaveformCanvas. */
    samplesRef,
    actions: {
      startLiveScan,
      startDemoScan,
      resetScan,
    },
  };
}
