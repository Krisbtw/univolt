import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type RefObject,
} from "react";
import {
  estimateSpo2,
  passesContactGate,
  type Spo2Quality,
  type Spo2Result,
  type Spo2Sample,
} from "../lib/spo2Engine";
import { useFusionSession } from "../lib/fusionStore";
import { useUnivolt } from "../lib/univolt/store";

export const SPO2_SCAN_DURATION_MS = 20_000;

const FRAME_INTERVAL_MS = 1000 / 30; // ~30 fps
const UI_COMMIT_INTERVAL_MS = 500;   // 2 Hz UI state commits
const PROCESS_W = 160;
const PROCESS_H = 120;
const CONTACT_START_MS = 500;
const CONTACT_LOST_ABORT_MS = 15_000;
const WAVEFORM_WINDOW_SAMPLES = 180;

export type Spo2Phase = "idle" | "positioning" | "measuring" | "complete";
export type Spo2Status = "ok" | "no_contact" | "weak_signal" | "unavailable" | "camera_error";
export type Spo2Permission = "undetermined" | "requesting" | "granted" | "denied" | "unsupported";

export interface Spo2ScanState {
  phase: Spo2Phase;
  permission: Spo2Permission;
  status: Spo2Status;
  progressMs: number;
  contactSec: number;
  result: Spo2Result | null;
}

type Action =
  | { type: "PERMISSION"; status: Spo2Permission }
  | { type: "STATUS"; status: Spo2Status }
  | { type: "START_POSITIONING" }
  | { type: "START_MEASURING" }
  | { type: "SNAPSHOT"; progressMs: number; contactSec: number }
  | { type: "COMPLETED"; result: Spo2Result }
  | { type: "ABORT_TO_POSITIONING" }
  | { type: "RESET" };

const INITIAL_STATE: Spo2ScanState = {
  phase: "idle",
  permission: "undetermined",
  status: "ok",
  progressMs: 0,
  contactSec: 0,
  result: null,
};

function reducer(state: Spo2ScanState, action: Action): Spo2ScanState {
  switch (action.type) {
    case "PERMISSION":
      return state.permission === action.status ? state : { ...state, permission: action.status };
    case "STATUS":
      return state.status === action.status ? state : { ...state, status: action.status };
    case "START_POSITIONING":
      return {
        ...state,
        phase: "positioning",
        permission: "granted",
        status: "no_contact",
        progressMs: 0,
        contactSec: 0,
        result: null,
      };
    case "START_MEASURING":
      if (state.phase !== "positioning") return state;
      return {
        ...state,
        phase: "measuring",
        status: "ok",
        progressMs: 0,
        contactSec: 0,
      };
    case "SNAPSHOT":
      if (state.phase !== "measuring") return state;
      return {
        ...state,
        progressMs: action.progressMs,
        contactSec: action.contactSec,
      };
    case "COMPLETED":
      return {
        ...state,
        phase: "complete",
        progressMs: SPO2_SCAN_DURATION_MS,
        contactSec: action.result.contactSec,
        result: action.result,
      };
    case "ABORT_TO_POSITIONING":
      if (state.phase !== "measuring") return state;
      return {
        ...state,
        phase: "positioning",
        status: "no_contact",
        progressMs: 0,
        contactSec: 0,
      };
    case "RESET":
      return {
        ...INITIAL_STATE,
        permission: state.permission === "granted" ? "granted" : state.permission,
        phase: state.permission === "granted" ? "positioning" : "idle",
      };
    default:
      return state;
  }
}

export interface UseSpo2FingerScanOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  ppgCanvasRef?: RefObject<HTMLCanvasElement | null>;
  patientId?: string;
  onBeforeStart?: () => void;
  onComplete?: (result: Spo2Result) => void;
}

export interface UseSpo2FingerScanApi {
  state: Spo2ScanState;
  actions: {
    start: () => void;
    reset: () => void;
    cancel: () => void;
  };
}

function centerRoiMeans(pixels: Uint8ClampedArray, width: number, height: number) {
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.ceil(height * 0.8);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * width + x) * 4;
      red += pixels[idx];
      green += pixels[idx + 1];
      blue += pixels[idx + 2];
      count++;
    }
  }
  return {
    red: count > 0 ? red / count : 0,
    green: count > 0 ? green / count : 0,
    blue: count > 0 ? blue / count : 0,
  };
}

export function useSpo2FingerScan({
  videoRef,
  ppgCanvasRef,
  patientId,
  onBeforeStart,
  onComplete,
}: UseSpo2FingerScanOptions): UseSpo2FingerScanApi {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const phaseRef = useRef<Spo2Phase>("idle");
  useLayoutEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const setSpo2 = useFusionSession((s) => s.setSpo2);
  const addFingerSpo2 = useUnivolt((s) => s.addFingerSpo2);
  const updateLatestVitalsSpo2 = useUnivolt((s) => s.updateLatestVitalsSpo2);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraSeqRef = useRef(0);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const samplesRef = useRef<Spo2Sample[]>([]);
  const redWaveRef = useRef<number[]>([]);
  const activeMsRef = useRef(0);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastCommitRef = useRef(0);
  const contactSeenSinceRef = useRef(0);
  const contactLostSinceRef = useRef(0);
  const contactFailCountRef = useRef(0);

  // ── Torch control & stream shutdown ──────────────────────────────────────────
  const stopCamera = useCallback((): void => {
    cameraSeqRef.current += 1;
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          void (track as any).applyConstraints?.({ advanced: [{ torch: false }] });
        } catch {
          // Ignore error on stopping track
        }
        track.stop();
      }
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  const clearWave = useCallback((): void => {
    const canvas = ppgCanvasRef?.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [ppgCanvasRef]);

  const drawWave = useCallback(
    (values: number[]): void => {
      const canvas = ppgCanvasRef?.current;
      if (!canvas || values.length < 2) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      let min = Infinity;
      let max = -Infinity;
      for (const v of values) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const range = Math.max(max - min, 1e-4);

      ctx.strokeStyle = "#145c4c"; // Pine primary trace
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * (w - 4) + 2;
        const y = h - 6 - ((values[i] - min) / range) * (h - 12);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    [ppgCanvasRef],
  );

  // ── Camera start with programmatic torch capability check ───────────────────
  const startCamera = useCallback(async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: "PERMISSION", status: "unsupported" });
      dispatch({ type: "STATUS", status: "unavailable" });
      return;
    }

    onBeforeStart?.();
    stopCamera();
    dispatch({ type: "PERMISSION", status: "requesting" });
    const sequence = cameraSeqRef.current + 1;
    cameraSeqRef.current = sequence;

    let stream: MediaStream | null = null;

    // 1. First try: rear environment camera at ~30fps
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
    } catch {
      // 2. Fallback: plain video: true
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      } catch {
        stopCamera();
        dispatch({ type: "PERMISSION", status: "denied" });
        dispatch({ type: "STATUS", status: "camera_error" });
        return;
      }
    }

    if (cameraSeqRef.current !== sequence) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((item) => item.stop());
      dispatch({ type: "PERMISSION", status: "unsupported" });
      dispatch({ type: "STATUS", status: "unavailable" });
      return;
    }

    // Capability gate: check torch support
    const capabilities = (track as any).getCapabilities?.();
    if (!capabilities?.torch) {
      stream.getTracks().forEach((item) => item.stop());
      dispatch({ type: "PERMISSION", status: "unsupported" });
      dispatch({ type: "STATUS", status: "unavailable" });
      return;
    }

    // Programmatic torch activation
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: true }] });
    } catch {
      stream.getTracks().forEach((item) => item.stop());
      dispatch({ type: "PERMISSION", status: "unsupported" });
      dispatch({ type: "STATUS", status: "unavailable" });
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      try {
        await videoRef.current.play();
      } catch {
        // Muted inline playback
      }
    }

    samplesRef.current = [];
    redWaveRef.current = [];
    activeMsRef.current = 0;
    contactSeenSinceRef.current = 0;
    contactLostSinceRef.current = 0;
    contactFailCountRef.current = 0;
    lastCommitRef.current = 0;

    dispatch({ type: "PERMISSION", status: "granted" });
    dispatch({ type: "START_POSITIONING" });
  }, [onBeforeStart, stopCamera, videoRef]);

  // ── Frame analysis ─────────────────────────────────────────────────────────
  const processFrame = useCallback(
    (now: number, delta: number): boolean => {
      if (now - lastFrameRef.current < FRAME_INTERVAL_MS) return false;
      lastFrameRef.current = now;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return false;

      let canvas = processCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = PROCESS_W;
        canvas.height = PROCESS_H;
        processCanvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;
      ctx.drawImage(video, 0, 0, PROCESS_W, PROCESS_H);

      let pixels: Uint8ClampedArray;
      try {
        pixels = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H).data;
      } catch {
        return false;
      }

      const rgb = centerRoiMeans(pixels, PROCESS_W, PROCESS_H);
      const contact = passesContactGate(rgb.red, rgb.green, rgb.blue);
      const phase = phaseRef.current;

      if (!contact) {
        contactFailCountRef.current += 1;
        if (contactFailCountRef.current < 4) return false;
        contactSeenSinceRef.current = 0;

        if (phase === "measuring") {
          if (contactLostSinceRef.current === 0) contactLostSinceRef.current = now;
          const lostDuration = now - contactLostSinceRef.current;
          if (lostDuration >= CONTACT_LOST_ABORT_MS) {
            samplesRef.current = [];
            redWaveRef.current = [];
            activeMsRef.current = 0;
            dispatch({ type: "ABORT_TO_POSITIONING" });
          } else if (lostDuration >= 2_000) {
            dispatch({ type: "STATUS", status: "no_contact" });
          }
        } else if (phase === "positioning") {
          dispatch({ type: "STATUS", status: "no_contact" });
        }
        return false;
      }

      // Contact verified
      contactFailCountRef.current = 0;
      contactLostSinceRef.current = 0;

      if (phase === "positioning") {
        if (contactSeenSinceRef.current === 0) contactSeenSinceRef.current = now;
        if (now - contactSeenSinceRef.current >= CONTACT_START_MS) {
          samplesRef.current = [];
          redWaveRef.current = [];
          activeMsRef.current = 0;
          dispatch({ type: "START_MEASURING" });
        }
        return true;
      }

      if (phase !== "measuring") return true;

      // In measuring: accumulate contact time
      activeMsRef.current += delta;
      samplesRef.current.push({
        tMs: activeMsRef.current,
        red: rgb.red,
        green: rgb.green,
      });

      redWaveRef.current.push(rgb.red);
      if (redWaveRef.current.length > WAVEFORM_WINDOW_SAMPLES) {
        redWaveRef.current.shift();
      }

      return true;
    },
    [videoRef],
  );

  const finishScan = useCallback((): void => {
    const result = estimateSpo2(samplesRef.current);
    stopCamera();
    dispatch({ type: "COMPLETED", result });

    // Call fusion store setter
    setSpo2(result.spo2, result.quality);

    // If patient active, save as scan point flagged source: "finger"
    if (patientId && result.spo2 !== null && result.quality !== "reject") {
      addFingerSpo2(patientId, result.spo2, result.quality);
      updateLatestVitalsSpo2(patientId, result.spo2, result.quality);
    }

    onComplete?.(result);
  }, [addFingerSpo2, onComplete, patientId, setSpo2, stopCamera, updateLatestVitalsSpo2]);

  // ── rAF loop ───────────────────────────────────────────────────────────────
  const tick = useCallback(
    (now: number): void => {
      rafRef.current = requestAnimationFrame(tick);
      const rawDelta = lastTickRef.current === 0 ? 1000 / 60 : now - lastTickRef.current;
      const delta = Math.min(Math.max(rawDelta, 0), 100);
      lastTickRef.current = now;

      if (phaseRef.current === "complete" || phaseRef.current === "idle") return;

      const contact = processFrame(now, delta);
      if (phaseRef.current !== "measuring" || !contact) return;

      drawWave(redWaveRef.current);

      if (now - lastCommitRef.current >= UI_COMMIT_INTERVAL_MS) {
        lastCommitRef.current = now;
        dispatch({
          type: "SNAPSHOT",
          progressMs: activeMsRef.current,
          contactSec: Math.round(activeMsRef.current / 1000),
        });
        dispatch({ type: "STATUS", status: "ok" });
      }

      if (activeMsRef.current >= SPO2_SCAN_DURATION_MS) {
        finishScan();
      }
    },
    [drawWave, finishScan, processFrame],
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, [stopCamera, tick]);

  const start = useCallback((): void => {
    if (phaseRef.current === "idle" || phaseRef.current === "complete") {
      void startCamera();
    }
  }, [startCamera]);

  const reset = useCallback((): void => {
    stopCamera();
    samplesRef.current = [];
    redWaveRef.current = [];
    activeMsRef.current = 0;
    contactSeenSinceRef.current = 0;
    contactLostSinceRef.current = 0;
    contactFailCountRef.current = 0;
    clearWave();
    dispatch({ type: "RESET" });
  }, [clearWave, stopCamera]);

  const cancel = useCallback((): void => {
    reset();
  }, [reset]);

  return useMemo(
    () => ({ state, actions: { start, reset, cancel } }),
    [cancel, reset, start, state],
  );
}