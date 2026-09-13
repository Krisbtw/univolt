import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type RefObject,
} from "react";
import { makeId } from "../lib/univolt/database";
import {
  analyzeSpo2,
  isFingerContact,
  spo2Waveform,
  type Spo2Quality,
} from "../lib/spo2Engine";

export const SPO2_SCAN_DURATION_MS = 20_000;

const FRAME_INTERVAL_MS = 1000 / 30;
const UI_COMMIT_INTERVAL_MS = 500;
const PROCESS_W = 160;
const PROCESS_H = 120;
const WAVEFORM_WINDOW_SAMPLES = 180;
const WAVEFORM_W = 600;
const WAVEFORM_H = 140;
const CONTACT_START_MS = 600;
const CONTACT_LOST_ABORT_MS = 15_000;
const MIN_ANALYSIS_SAMPLES = 450;
const WAVE_COLOR = "#fb7185";

export type Spo2Phase = "idle" | "positioning" | "measuring" | "complete";
export type Spo2Status = "ok" | "no_contact" | "weak_signal" | "unavailable" | "camera_error";
export type Spo2Permission = "undetermined" | "requesting" | "granted" | "denied" | "unsupported";

export interface Spo2ScanResult {
  scanId: string;
  timestamp: number;
  durationMs: number;
  spo2: number | null;
  quality: Exclude<Spo2Quality, "manual">;
  peakCount: number;
  acRed: number;
  acGreen: number;
}

export interface Spo2ScanState {
  phase: Spo2Phase;
  permission: Spo2Permission;
  status: Spo2Status;
  progressMs: number;
  liveSpo2: number | null;
  result: Spo2ScanResult | null;
}

type Action =
  | { type: "PERMISSION"; status: Spo2Permission }
  | { type: "STATUS"; status: Spo2Status }
  | { type: "START_POSITIONING" }
  | { type: "START_MEASURING" }
  | { type: "SNAPSHOT"; progressMs: number; liveSpo2: number | null }
  | { type: "COMPLETED"; result: Spo2ScanResult }
  | { type: "ABORT_TO_POSITIONING" }
  | { type: "RESET" };

const INITIAL_STATE: Spo2ScanState = {
  phase: "idle",
  permission: "undetermined",
  status: "ok",
  progressMs: 0,
  liveSpo2: null,
  result: null,
};

function reducer(state: Spo2ScanState, action: Action): Spo2ScanState {
  switch (action.type) {
    case "PERMISSION":
      return state.permission === action.status
        ? state
        : { ...state, permission: action.status };
    case "STATUS":
      return state.status === action.status ? state : { ...state, status: action.status };
    case "START_POSITIONING":
      return {
        ...state,
        phase: "positioning",
        permission: "granted",
        status: "no_contact",
        progressMs: 0,
        liveSpo2: null,
        result: null,
      };
    case "START_MEASURING":
      if (state.phase !== "positioning") return state;
      return { ...state, phase: "measuring", progressMs: 0, liveSpo2: null, status: "ok" };
    case "SNAPSHOT":
      if (state.phase !== "measuring") return state;
      return { ...state, progressMs: action.progressMs, liveSpo2: action.liveSpo2 };
    case "COMPLETED":
      if (state.phase !== "measuring") return state;
      return {
        ...state,
        phase: "complete",
        progressMs: action.result.durationMs,
        liveSpo2: action.result.spo2,
        result: action.result,
      };
    case "ABORT_TO_POSITIONING":
      if (state.phase !== "measuring") return state;
      return {
        ...state,
        phase: "positioning",
        status: "no_contact",
        progressMs: 0,
        liveSpo2: null,
      };
    case "RESET":
      return {
        ...INITIAL_STATE,
        permission: state.permission === "granted" ? "granted" : state.permission,
        phase: state.permission === "granted" ? "positioning" : "idle",
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export interface UseSpo2FingerScanOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  ppgCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** Stops the face stream before the environment camera is requested. */
  onBeforeStart?: () => void;
}

export interface UseSpo2FingerScanApi {
  state: Spo2ScanState;
  actions: {
    start: () => void;
    reset: () => void;
    cancel: () => void;
  };
}

interface RgbMeans {
  red: number;
  green: number;
  blue: number;
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

function centerRoiMeans(pixels: Uint8ClampedArray, width: number, height: number): RgbMeans {
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
      const index = (y * width + x) * 4;
      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
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
  onBeforeStart,
}: UseSpo2FingerScanOptions): UseSpo2FingerScanApi {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const phaseRef = useRef<Spo2Phase>("idle");
  useLayoutEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraSeqRef = useRef(0);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const redSeriesRef = useRef<number[]>([]);
  const greenSeriesRef = useRef<number[]>([]);
  const activeMsRef = useRef(0);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastCommitRef = useRef(0);
  const contactSeenSinceRef = useRef(0);
  const contactLostSinceRef = useRef(0);
  const contactFailCountRef = useRef(0);

  const stopCamera = useCallback((): void => {
    cameraSeqRef.current += 1;
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          void track.applyConstraints(
            { advanced: [{ torch: false }] } as unknown as MediaTrackConstraints,
          );
        } catch {
          // The track may already be ending; stopping it below is sufficient.
        }
        track.stop();
      }
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  const clearWave = useCallback((): void => {
    const canvas = ppgCanvasRef.current;
    if (!canvas) return;
    canvas.width = WAVEFORM_W;
    canvas.height = WAVEFORM_H;
    canvas.getContext("2d")?.clearRect(0, 0, WAVEFORM_W, WAVEFORM_H);
  }, [ppgCanvasRef]);

  const drawWave = useCallback(
    (values: number[]): void => {
      const canvas = ppgCanvasRef.current;
      if (!canvas) return;
      if (canvas.width !== WAVEFORM_W || canvas.height !== WAVEFORM_H) {
        canvas.width = WAVEFORM_W;
        canvas.height = WAVEFORM_H;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, WAVEFORM_W, WAVEFORM_H);
      if (values.length < 2) return;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const value of values) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      const range = Math.max(max - min, 1e-6);
      ctx.strokeStyle = WAVE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * (WAVEFORM_W - 2) + 1;
        const y = WAVEFORM_H - 10 - ((values[i] - min) / range) * (WAVEFORM_H - 20);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    [ppgCanvasRef],
  );

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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
      if (cameraSeqRef.current !== sequence) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as TorchCapabilities | undefined;
      if (!track || !capabilities?.torch) {
        stream.getTracks().forEach((item) => item.stop());
        dispatch({ type: "PERMISSION", status: "unsupported" });
        dispatch({ type: "STATUS", status: "unavailable" });
        return;
      }

      try {
        await track.applyConstraints(
          { advanced: [{ torch: true }] } as unknown as MediaTrackConstraints,
        );
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
          // Muted inline playback is normally allowed; the rAF loop will retry
          // once the browser has a current frame.
        }
      }
      redSeriesRef.current = [];
      greenSeriesRef.current = [];
      activeMsRef.current = 0;
      contactSeenSinceRef.current = 0;
      contactLostSinceRef.current = 0;
      contactFailCountRef.current = 0;
      lastCommitRef.current = 0;
      dispatch({ type: "PERMISSION", status: "granted" });
      dispatch({ type: "START_POSITIONING" });
    } catch {
      stopCamera();
      dispatch({ type: "PERMISSION", status: "denied" });
      dispatch({ type: "STATUS", status: "camera_error" });
    }
  }, [onBeforeStart, stopCamera, videoRef]);

  const processFrame = useCallback(
    (now: number): boolean => {
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
      const contact = isFingerContact(rgb.red, rgb.green, rgb.blue);
      const phase = phaseRef.current;

      if (!contact) {
        contactFailCountRef.current += 1;
        if (contactFailCountRef.current < 10) return false;
        contactSeenSinceRef.current = 0;
        if (phase === "measuring") {
          if (contactLostSinceRef.current === 0) contactLostSinceRef.current = now;
          if (now - contactLostSinceRef.current >= CONTACT_LOST_ABORT_MS) {
            redSeriesRef.current = [];
            greenSeriesRef.current = [];
            activeMsRef.current = 0;
            dispatch({ type: "ABORT_TO_POSITIONING" });
          } else if (now - contactLostSinceRef.current >= 2_000) {
            dispatch({ type: "STATUS", status: "no_contact" });
          }
        } else if (phase === "positioning") {
          dispatch({ type: "STATUS", status: "no_contact" });
        }
        return false;
      }

      contactLostSinceRef.current = 0;
      if (phase === "positioning") {
        if (contactSeenSinceRef.current === 0) contactSeenSinceRef.current = now;
        if (now - contactSeenSinceRef.current >= CONTACT_START_MS) {
          redSeriesRef.current = [];
          greenSeriesRef.current = [];
          activeMsRef.current = 0;
          dispatch({ type: "START_MEASURING" });
        }
        return true;
      }

      if (phase !== "measuring") return true;
      redSeriesRef.current.push(rgb.red);
      greenSeriesRef.current.push(rgb.green);
      return true;
    },
    [videoRef],
  );

  const finishScan = useCallback((): void => {
    const sampleCount = Math.min(redSeriesRef.current.length, greenSeriesRef.current.length);
    const fs = activeMsRef.current > 0 ? (sampleCount * 1000) / activeMsRef.current : 0;
    const analysis = analyzeSpo2(redSeriesRef.current, greenSeriesRef.current, fs);
    stopCamera();
    dispatch({
      type: "COMPLETED",
      result: {
        ...analysis,
        scanId: makeId("spo2"),
        timestamp: Date.now(),
        durationMs: SPO2_SCAN_DURATION_MS,
      },
    });
  }, [stopCamera]);

  const tick = useCallback(
    (now: number): void => {
      rafRef.current = requestAnimationFrame(tick);
      const rawDelta = lastTickRef.current === 0 ? 1000 / 60 : now - lastTickRef.current;
      const delta = Math.min(Math.max(rawDelta, 0), 100);
      lastTickRef.current = now;
      if (phaseRef.current === "complete" || phaseRef.current === "idle") return;

      const contact = processFrame(now);
      if (phaseRef.current !== "measuring" || !contact) return;

      activeMsRef.current += delta;
      drawWave(spo2Waveform(redSeriesRef.current, WAVEFORM_WINDOW_SAMPLES));
      if (now - lastCommitRef.current >= UI_COMMIT_INTERVAL_MS) {
        lastCommitRef.current = now;
        const sampleCount = Math.min(redSeriesRef.current.length, greenSeriesRef.current.length);
        const fs = activeMsRef.current > 0 ? (sampleCount * 1000) / activeMsRef.current : 0;
        const analysis = analyzeSpo2(redSeriesRef.current, greenSeriesRef.current, fs);
        dispatch({
          type: "SNAPSHOT",
          progressMs: activeMsRef.current,
          liveSpo2: analysis.spo2,
        });
        dispatch({
          type: "STATUS",
          status: analysis.spo2 === null && sampleCount > MIN_ANALYSIS_SAMPLES ? "weak_signal" : "ok",
        });
      }
      if (activeMsRef.current >= SPO2_SCAN_DURATION_MS) finishScan();
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
    if (phaseRef.current === "idle" || phaseRef.current === "complete") void startCamera();
  }, [startCamera]);

  const reset = useCallback((): void => {
    stopCamera();
    redSeriesRef.current = [];
    greenSeriesRef.current = [];
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