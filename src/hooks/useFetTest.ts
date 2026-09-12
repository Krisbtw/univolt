/**
 * useFetTest.ts — Forced Expiratory Time (FET) hook.
 * Mirrors useRppgScan's architecture: all per-frame data in refs,
 * React state commits ≤2×/s, rAF loop for canvas rendering.
 */
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type RefObject,
} from "react";
import {
  buildFetResult,
  classifyFet,
  computeRms,
  detectExhalation,
  estimateNoiseFloor,
  type FetResult,
} from "../lib/breathAudioEngine";
import { useFusionSession } from "../lib/fusionStore";

// ── Types ────────────────────────────────────────────────────────────────────

export type FetPhase =
  | "idle"
  | "calibrating"   // 1 s ambient noise measurement
  | "instruction"   // show instruction; wait for big Start button or auto-onset
  | "recording"     // live exhalation capture
  | "between"       // brief pause between trials
  | "done";

export type FetPermission = "undetermined" | "requesting" | "granted" | "denied" | "unsupported";

export interface FetState {
  phase: FetPhase;
  permission: FetPermission;
  /** Trial index (0 or 1). */
  trial: number;
  /** Live exhalation duration in current trial (seconds). */
  liveSec: number;
  result: FetResult | null;
  error: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_RATE_HZ = 60;
const FRAME_INTERVAL_MS = 1000 / SAMPLE_RATE_HZ;
const CALIBRATION_MS = 1000;
const MAX_TRIAL_MS = 15_000;
const BETWEEN_TRIAL_MS = 2_000;
const TOTAL_TRIALS = 2;
const FFT_SIZE = 1024;

// Canvas dimensions
const CANVAS_W = 600;
const CANVAS_H = 120;
const WAVE_COLOR = "#34d399";
const NOISE_COLOR = "rgba(251,191,36,0.4)";
const ENVELOPE_WINDOW_SAMPLES = SAMPLE_RATE_HZ * 6; // last 6 s shown on canvas

// ── Reducer ───────────────────────────────────────────────────────────────────

type FetAction =
  | { type: "PERMISSION"; status: FetPermission }
  | { type: "START_CALIBRATION" }
  | { type: "CALIBRATION_DONE" }
  | { type: "START_RECORDING" }
  | { type: "SNAPSHOT"; liveSec: number }
  | { type: "TRIAL_DONE"; result: FetResult; isLast: boolean }
  | { type: "NEXT_TRIAL" }
  | { type: "RESET" }
  | { type: "ERROR"; message: string };

const initialState: FetState = {
  phase: "idle",
  permission: "undetermined",
  trial: 0,
  liveSec: 0,
  result: null,
  error: null,
};

function reducer(state: FetState, action: FetAction): FetState {
  switch (action.type) {
    case "PERMISSION":
      return { ...state, permission: action.status };
    case "START_CALIBRATION":
      return { ...state, phase: "calibrating", error: null };
    case "CALIBRATION_DONE":
      return { ...state, phase: "instruction" };
    case "START_RECORDING":
      return { ...state, phase: "recording", liveSec: 0 };
    case "SNAPSHOT":
      return { ...state, liveSec: action.liveSec };
    case "TRIAL_DONE":
      return {
        ...state,
        phase: action.isLast ? "done" : "between",
        result: action.result,
        trial: action.isLast ? state.trial : state.trial + 1,
      };
    case "NEXT_TRIAL":
      return { ...state, phase: "instruction", liveSec: 0 };
    case "RESET":
      return { ...initialState };
    case "ERROR":
      return { ...state, error: action.message, phase: "idle" };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFetTest({
  canvasRef,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const setFet = useFusionSession((s) => s.setFet);

  // ── Refs (no setState per frame) ──
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer>>(new Float32Array(new ArrayBuffer(FFT_SIZE * 4)));

  // Envelope history (ring buffer)
  const envelopeRef = useRef<number[]>([]);
  // Ambient samples for noise floor calibration
  const ambientRef = useRef<number[]>([]);
  const noiseFloorRef = useRef<number>(0.003);
  // Trial data
  const trialSecsRef = useRef<number[]>([]);
  const recordingStartRef = useRef<number>(0);
  const lastCommitRef = useRef<number>(0);
  const phaseRef = useRef<FetPhase>("idle");

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // ── Canvas draw ───────────────────────────────────────────────────────────

  const drawCanvas = useCallback(
    (noiseFloor: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      const env = envelopeRef.current;
      const window = env.slice(-ENVELOPE_WINDOW_SAMPLES);
      if (window.length === 0) return;

      // Noise floor line
      const maxAmp = Math.max(noiseFloor * 6, 0.05);
      const floorY = CANVAS_H - (noiseFloor / maxAmp) * CANVAS_H;
      ctx.strokeStyle = NOISE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(CANVAS_W, floorY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Envelope waveform
      ctx.strokeStyle = WAVE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < window.length; i++) {
        const x = (i / (ENVELOPE_WINDOW_SAMPLES - 1)) * CANVAS_W;
        const y = CANVAS_H - ((window[i]! / maxAmp) * CANVAS_H * 0.9);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    [canvasRef],
  );

  // ── rAF loop ──────────────────────────────────────────────────────────────

  const loop = useCallback(
    (now: number) => {
      const analyser = analyserRef.current;
      if (!analyser) return;

      analyser.getFloatTimeDomainData(bufferRef.current);
      const rms = computeRms(bufferRef.current);

      envelopeRef.current.push(rms);
      // Keep at most 30 s of history
      if (envelopeRef.current.length > SAMPLE_RATE_HZ * 30) {
        envelopeRef.current.shift();
      }

      const phase = phaseRef.current;

      if (phase === "calibrating") {
        ambientRef.current.push(rms);
        if (ambientRef.current.length >= Math.round(CALIBRATION_MS / FRAME_INTERVAL_MS)) {
          noiseFloorRef.current = estimateNoiseFloor(ambientRef.current);
          phaseRef.current = "instruction";
          dispatch({ type: "CALIBRATION_DONE" });
        }
      } else if (phase === "instruction") {
        // Auto-start on detected onset
        const threshold = Math.max(3 * noiseFloorRef.current, 0.003);
        if (rms >= threshold) {
          recordingStartRef.current = now;
          phaseRef.current = "recording";
          dispatch({ type: "START_RECORDING" });
        }
      } else if (phase === "recording") {
        const elapsed = (now - recordingStartRef.current) / 1000;

        // Throttle React state commits (liveSec) to ≤2×/s
        if (now - lastCommitRef.current >= 500) {
          lastCommitRef.current = now;
          dispatch({ type: "SNAPSHOT", liveSec: elapsed });
        }

        drawCanvas(noiseFloorRef.current);

        // Check for auto-end: silence offset OR safety cap
        const env = envelopeRef.current;
        const recordingSamples = env.slice(-Math.round(elapsed * SAMPLE_RATE_HZ));
        const seg = detectExhalation(recordingSamples, noiseFloorRef.current, SAMPLE_RATE_HZ);
        const timedOut = elapsed >= MAX_TRIAL_MS / 1000;

        const trialDuration = seg?.durationSec ?? elapsed;
        const shouldEnd =
          timedOut ||
          (seg != null && seg.endIdx < recordingSamples.length - Math.round(0.5 * SAMPLE_RATE_HZ));

        if (shouldEnd) {
          trialSecsRef.current.push(trialDuration);
          const isLast = trialSecsRef.current.length >= TOTAL_TRIALS;
          const result = buildFetResult(trialSecsRef.current);
          if (isLast) {
            setFet(result.bestSec);
            phaseRef.current = "done";
          } else {
            phaseRef.current = "between";
            window.setTimeout(() => {
              phaseRef.current = "instruction";
              dispatch({ type: "NEXT_TRIAL" });
            }, BETWEEN_TRIAL_MS);
          }
          dispatch({ type: "TRIAL_DONE", result, isLast });
        }
      } else if (phase === "between" || phase === "done" || phase === "idle") {
        drawCanvas(noiseFloorRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [drawCanvas, setFet],
  );

  // ── Start mic ─────────────────────────────────────────────────────────────

  const startTest = useCallback(async () => {
    stopAudio();
    trialSecsRef.current = [];
    ambientRef.current = [];
    envelopeRef.current = [];
    phaseRef.current = "calibrating";

    dispatch({ type: "PERMISSION", status: "requesting" });

    if (!navigator.mediaDevices?.getUserMedia) {
      dispatch({ type: "PERMISSION", status: "unsupported" });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.1;
    source.connect(analyser);
    analyserRef.current = analyser;
    bufferRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));

    dispatch({ type: "START_CALIBRATION" });
    rafRef.current = requestAnimationFrame(loop);
  }, [stopAudio, loop]);

  /** Manual start — called when user taps the Start button during instruction phase. */
  const forceStart = useCallback(() => {
    if (phaseRef.current !== "instruction") return;
    recordingStartRef.current = performance.now();
    phaseRef.current = "recording";
    dispatch({ type: "START_RECORDING" });
  }, []);

  const reset = useCallback(() => {
    stopAudio();
    trialSecsRef.current = [];
    ambientRef.current = [];
    envelopeRef.current = [];
    noiseFloorRef.current = 0.003;
    phaseRef.current = "idle";
    dispatch({ type: "RESET" });
  }, [stopAudio]);

  return {
    state,
    actions: { startTest, forceStart, reset },
  };
}
