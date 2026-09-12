/**
 * useCrtScan.ts — Camera-based Capillary Refill Time hook.
 * Mirrors useRppgScan's architecture exactly:
 *  - getUserMedia video 640×480 @ 30 fps
 *  - rAF loop throttled to 30 fps, 160×120 offscreen canvas (willReadFrequently)
 *  - ALL per-frame data in refs — never setState per frame
 *  - Throttled state commits ≤ 2×/s
 *  - Live redness curve drawn on canvas (nail = green, control = grey)
 */
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type RefObject,
} from "react";
import {
  buildCrtResult,
  detectCrtPhases,
  rednessIndex,
  type CrtPhase,
  type CrtResult,
  type CrtSample,
} from "../lib/crtEngine";
import { useFusionSession } from "../lib/fusionStore";

// ── Types ────────────────────────────────────────────────────────────────────

export type CrtScanPhase =
  | "idle"
  | "align"       // align nail in box
  | "baseline"    // collecting 1 s baseline
  | "press"       // user presses nail — countdown
  | "measuring"   // watching for release + recovery
  | "complete"
  | "failed";

export type CrtPermission =
  | "undetermined"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

export interface CrtScanState {
  phase: CrtScanPhase;
  permission: CrtPermission;
  /** Current CRT engine phase (sub-state during measuring). */
  crtPhase: CrtPhase;
  /** Live elapsed ms since release (shown to user during recovery). */
  recoveryMs: number;
  result: CrtResult | null;
  failureReason: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAME_INTERVAL_MS = 1000 / 30;
const PROCESS_W = 160;
const PROCESS_H = 120;
const COMMIT_INTERVAL_MS = 500;
const CANVAS_W = 600;
const CANVAS_H = 120;
const WAVEFORM_WINDOW_MS = 10_000;
// ROI layout on the 160×120 frame (normalised 0–1)
const NAIL_ROI  = { x: 0.3, y: 0.2, w: 0.2, h: 0.5 }; // centre
const CTRL_ROI  = { x: 0.55, y: 0.2, w: 0.2, h: 0.5 }; // adjacent
// Baseline: collect for 2 s before "press now" instruction
const BASELINE_COLLECT_MS = 2_000;

// ── Reducer ───────────────────────────────────────────────────────────────────

type CrtAction =
  | { type: "PERMISSION"; status: CrtPermission }
  | { type: "START_ALIGN" }
  | { type: "START_BASELINE" }
  | { type: "START_PRESS" }
  | { type: "START_MEASURING" }
  | { type: "SNAPSHOT"; crtPhase: CrtPhase; recoveryMs: number }
  | { type: "COMPLETE"; result: CrtResult }
  | { type: "FAIL"; reason: string }
  | { type: "RESET" };

const INITIAL: CrtScanState = {
  phase: "idle",
  permission: "undetermined",
  crtPhase: "baseline",
  recoveryMs: 0,
  result: null,
  failureReason: null,
};

function reducer(state: CrtScanState, action: CrtAction): CrtScanState {
  switch (action.type) {
    case "PERMISSION":
      return state.permission === action.status
        ? state
        : {
            ...state,
            permission: action.status,
            phase: action.status === "granted" ? "align" : state.phase,
          };
    case "START_ALIGN":
      return { ...state, phase: "align" };
    case "START_BASELINE":
      return { ...state, phase: "baseline" };
    case "START_PRESS":
      return { ...state, phase: "press" };
    case "START_MEASURING":
      return { ...state, phase: "measuring", crtPhase: "pressed", recoveryMs: 0 };
    case "SNAPSHOT":
      return state.phase !== "measuring" && state.phase !== "baseline"
        ? state
        : { ...state, crtPhase: action.crtPhase, recoveryMs: action.recoveryMs };
    case "COMPLETE":
      return { ...state, phase: "complete", result: action.result };
    case "FAIL":
      return { ...state, phase: "failed", failureReason: action.reason };
    case "RESET":
      return { ...INITIAL, permission: state.permission };
    default: {
      const _: never = action;
      return _;
    }
  }
}

// ── Mean ROI helper ───────────────────────────────────────────────────────────

function roiMeanRgb(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  roi: { x: number; y: number; w: number; h: number },
): { r: number; g: number; b: number } {
  const x0 = Math.floor(roi.x * w);
  const y0 = Math.floor(roi.y * h);
  const x1 = Math.min(w - 1, Math.floor((roi.x + roi.w) * w));
  const y1 = Math.min(h - 1, Math.floor((roi.y + roi.h) * h));
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      sr += pixels[i]!;
      sg += pixels[i + 1]!;
      sb += pixels[i + 2]!;
      n++;
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0 };
  return { r: sr / n, g: sg / n, b: sb / n };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCrtScan({
  videoRef,
  waveCanvasRef,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  waveCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const setCrt = useFusionSession((s) => s.setCrt);

  // ── Refs (no setState per frame) ──────────────────────────────────────────
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastCommitRef = useRef<number>(0);
  const samplesRef = useRef<CrtSample[]>([]);
  const phaseRef = useRef<CrtScanPhase>("idle");
  const baselineStartRef = useRef<number>(0);
  const measureStartRef = useRef<number>(0);

  // ── Canvas drawing ────────────────────────────────────────────────────────

  const drawWave = useCallback(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const samples = samplesRef.current;
    if (samples.length < 2) return;

    const tNow = samples[samples.length - 1]!.tMs;
    const tStart = tNow - WAVEFORM_WINDOW_MS;
    const visible = samples.filter((s) => s.tMs >= tStart);
    if (visible.length < 2) return;

    const minR = Math.min(...visible.map((s) => Math.min(s.redness, s.controlRedness)));
    const maxR = Math.max(...visible.map((s) => Math.max(s.redness, s.controlRedness)));
    const range = maxR - minR || 0.01;

    const toX = (t: number) => ((t - tStart) / WAVEFORM_WINDOW_MS) * CANVAS_W;
    const toY = (r: number) => CANVAS_H - ((r - minR) / range) * CANVAS_H * 0.85 - CANVAS_H * 0.07;

    // Control (grey)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    visible.forEach((s, i) => {
      const x = toX(s.tMs);
      const y = toY(s.controlRedness);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Nail (green)
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.beginPath();
    visible.forEach((s, i) => {
      const x = toX(s.tMs);
      const y = toY(s.redness);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [waveCanvasRef]);

  // ── rAF loop ──────────────────────────────────────────────────────────────

  const loop = useCallback(
    (now: number) => {
      rafRef.current = requestAnimationFrame(loop);

      // Throttle to 30 fps
      if (now - lastFrameRef.current < FRAME_INTERVAL_MS) return;
      lastFrameRef.current = now;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      // Ensure offscreen canvas
      if (!offscreenRef.current) {
        const c = document.createElement("canvas");
        c.width = PROCESS_W;
        c.height = PROCESS_H;
        offscreenRef.current = c;
        offCtxRef.current = c.getContext("2d", { willReadFrequently: true });
      }
      const offCtx = offCtxRef.current;
      if (!offCtx) return;

      offCtx.drawImage(video, 0, 0, PROCESS_W, PROCESS_H);
      const pixels = offCtx.getImageData(0, 0, PROCESS_W, PROCESS_H).data;

      const nail = roiMeanRgb(pixels, PROCESS_W, PROCESS_H, NAIL_ROI);
      const ctrl = roiMeanRgb(pixels, PROCESS_W, PROCESS_H, CTRL_ROI);
      const redness = rednessIndex(nail.r, nail.g, nail.b);
      const controlRedness = rednessIndex(ctrl.r, ctrl.g, ctrl.b);

      const currentPhase = phaseRef.current;

      if (currentPhase === "align") {
        // Nothing to collect, just draw
        drawWave();
        return;
      }

      // Push sample during baseline and measuring
      if (currentPhase === "baseline" || currentPhase === "press" || currentPhase === "measuring") {
        samplesRef.current.push({ tMs: now, redness, controlRedness });
      }

      drawWave();

      // Baseline auto-advance
      if (currentPhase === "baseline") {
        const elapsed = now - baselineStartRef.current;
        if (elapsed >= BASELINE_COLLECT_MS) {
          phaseRef.current = "press";
          dispatch({ type: "START_PRESS" });
        }
        return;
      }

      // During press phase — wait for user to press (detected by engine) then switch to measuring
      if (currentPhase === "press") {
        const result = detectCrtPhases(samplesRef.current);
        if (result.phase === "pressed") {
          phaseRef.current = "measuring";
          measureStartRef.current = now;
          dispatch({ type: "START_MEASURING" });
        }
        return;
      }

      // Measuring phase — run engine and watch for completion/failure
      if (currentPhase === "measuring") {
        const result = detectCrtPhases(samplesRef.current);

        if (result.phase === "recovered" && result.crtSec !== null) {
          const crtResult = buildCrtResult(result.crtSec);
          setCrt(result.crtSec);
          phaseRef.current = "complete";
          dispatch({ type: "COMPLETE", result: crtResult });
          return;
        }

        if (result.phase === "failed") {
          phaseRef.current = "failed";
          dispatch({ type: "FAIL", reason: result.failureReason ?? "unknown" });
          return;
        }

        // Throttled React state update
        if (now - lastCommitRef.current >= COMMIT_INTERVAL_MS) {
          lastCommitRef.current = now;
          const recoveryMs = result.phase === "released"
            ? now - measureStartRef.current
            : 0;
          dispatch({ type: "SNAPSHOT", crtPhase: result.phase, recoveryMs });
        }
      }
    },
    [videoRef, drawWave, setCrt],
  );

  // ── Camera init ───────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  const startCamera = useCallback(async () => {
    stopCamera();
    samplesRef.current = [];
    phaseRef.current = "idle";
    dispatch({ type: "PERMISSION", status: "requesting" });

    if (!navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: "PERMISSION", status: "unsupported" });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : "";
      dispatch({
        type: "PERMISSION",
        status: name === "NotAllowedError" || name === "PermissionDeniedError" ? "denied" : "unsupported",
      });
      return;
    }

    dispatch({ type: "PERMISSION", status: "granted" });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }

    phaseRef.current = "align";
    rafRef.current = requestAnimationFrame(loop);
  }, [stopCamera, videoRef, loop]);

  /** Call when user taps "I'm ready" after aligning the nail. */
  const startBaseline = useCallback(() => {
    if (phaseRef.current !== "align") return;
    samplesRef.current = [];
    baselineStartRef.current = performance.now();
    phaseRef.current = "baseline";
    dispatch({ type: "START_BASELINE" });
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    samplesRef.current = [];
    phaseRef.current = "idle";
    dispatch({ type: "RESET" });
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    state,
    actions: { startCamera, startBaseline, reset },
  };
}
