import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
    useRef,
    type RefObject,
} from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import {
    createFaceTracker,
    detectFace,
    foreheadCheekRoi,
    loadFaceDetector,
    skinRegionRoi,
    type RoiRect,
} from "../lib/faceDetector";
import { analyzeRppg, liveWaveform, type RppgAnalysis, type RppgSample } from "../lib/rppgEngine";
import { makeId } from "../lib/vitalsDatabase";

/** 25 s of face signal — inside the 20–30 s sweet spot for stable rPPG. */
export const SCAN_DURATION_MS = 25_000;
const FRAME_INTERVAL_MS = 1000 / 30; // throttle frame sampling to ~30 fps
const UI_COMMIT_INTERVAL_MS = 500; // numeric readouts commit to React state at most 2×/s
const PROCESS_W = 160; // downsampled frame size for pixel reads
const PROCESS_H = 120;
const PPG_WINDOW_MS = 6_000; // rolling waveform window on the canvas
const PPG_CANVAS_W = 600;
const PPG_CANVAS_H = 140;
const WAVE_COLOR = "#34d399";
const FACE_PRESENT_START_MS = 1_000; // face visible this long → auto-start measuring
const FACE_LOST_ABORT_MS = 2_000; // face gone this long → back to positioning
const LOW_LIGHT_ABORT_MS = 5_000;
const MOTION_PER_FRAME = 0.02; // ≥ 2 % of frame per frame counts as movement
const MOTION_WINDOW_MS = 5_000;
const MAX_MOTION_RATIO = 0.45; // > 45 % moving frames in 5 s → abort
const MIN_LUMA = 40; // mean ROI brightness floor
const MIN_SIGNAL_SAMPLES = 450; // ~15 s — persistent unreadability is worth surfacing

export type Phase = "idle" | "positioning" | "measuring" | "complete";
export type Status =
    | "ok"
    | "loading_model"
    | "model_fallback"
    | "no_face"
    | "motion"
    | "low_light"
    | "weak_signal";
export type PermissionStatus =
    | "undetermined"
    | "requesting"
    | "granted"
    | "denied"
    | "unsupported";

export interface ScanResult extends RppgAnalysis {
    scanId: string;
    timestamp: number;
    durationMs: number;
}

export interface RppgScanState {
    phase: Phase;
    permission: PermissionStatus;
    status: Status;
    progressMs: number;
    liveBpm: number | null;
    result: ScanResult | null;
}

type Action =
    | { type: "PERMISSION"; status: PermissionStatus }
    | { type: "STATUS"; status: Status }
    | { type: "START_MEASURING" }
    | { type: "ABORT_TO_POSITIONING"; status: Status }
    | { type: "SNAPSHOT"; progressMs: number; liveBpm: number | null }
    | { type: "COMPLETED"; result: ScanResult }
    | { type: "RESET" };

const INITIAL_STATE: RppgScanState = {
    phase: "idle",
    permission: "undetermined",
    status: "loading_model",
    progressMs: 0,
    liveBpm: null,
    result: null,
};

/**
 * Single source of truth:
 *   idle → positioning (camera granted) → measuring → complete
 *   measuring → positioning (abort: face lost / motion / low light)
 *   complete → positioning (New Scan)
 * Reducer ignores illegal transitions, so double-dispatches from the rAF
 * loop are idempotent.
 */
function reducer(state: RppgScanState, action: Action): RppgScanState {
    switch (action.type) {
        case "PERMISSION":
            if (action.status === "granted" && state.phase === "idle") {
                return { ...state, permission: "granted", phase: "positioning" };
            }
            return state.permission === action.status
                ? state
                : { ...state, permission: action.status };
        case "STATUS":
            return state.status === action.status ? state : { ...state, status: action.status };
        case "START_MEASURING":
            if (state.phase !== "positioning") return state;
            return {
                ...state,
                phase: "measuring",
                progressMs: 0,
                liveBpm: null,
                result: null,
                status: "ok",
            };
        case "ABORT_TO_POSITIONING":
            if (state.phase !== "measuring") return state;
            return {
                ...state,
                phase: "positioning",
                status: action.status,
                progressMs: 0,
                liveBpm: null,
            };
        case "SNAPSHOT":
            if (state.phase !== "measuring") return state;
            return { ...state, progressMs: action.progressMs, liveBpm: action.liveBpm };
        case "COMPLETED":
            if (state.phase !== "measuring") return state;
            return {
                ...state,
                phase: "complete",
                progressMs: action.result.durationMs,
                result: action.result,
                liveBpm: action.result.bpm,
            };
        case "RESET":
            if (state.permission === "granted") {
                return {
                    ...INITIAL_STATE,
                    permission: state.permission,
                    phase: "positioning",
                    status: "ok",
                };
            }
            return { ...INITIAL_STATE, permission: state.permission };
        default: {
            const exhaustive: never = action;
            return exhaustive;
        }
    }
}

// ---------- helpers ----------
interface RoiMeans {
    r: number;
    g: number;
    b: number;
    luma: number;
}
function roiMeans(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    rois: RoiRect[],
): RoiMeans | null {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    for (const roi of rois) {
        const x0 = Math.min(width, Math.max(0, Math.floor(roi.x * width)));
        const x1 = Math.min(width, Math.max(0, Math.ceil((roi.x + roi.w) * width)));
        const y0 = Math.min(height, Math.max(0, Math.floor(roi.y * height)));
        const y1 = Math.min(height, Math.max(0, Math.ceil((roi.y + roi.h) * height)));
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const idx = (y * width + x) * 4;
                rSum += pixels[idx];
                gSum += pixels[idx + 1];
                bSum += pixels[idx + 2];
                count += 1;
            }
        }
    }
    if (count === 0) return null;
    const r = rSum / count;
    const g = gSum / count;
    const b = bSum / count;
    return { r, g, b, luma: 0.299 * r + 0.587 * g + 0.114 * b };
}

export interface UseRppgScanOptions {
    videoRef: RefObject<HTMLVideoElement | null>;
    ppgCanvasRef: RefObject<HTMLCanvasElement | null>;
}
export interface UseRppgScanApi {
    state: RppgScanState;
    actions: {
        reset: () => void;
        requestCamera: () => void;
        releaseCamera: () => void;
    };
}

export function useRppgScan({ videoRef, ppgCanvasRef }: UseRppgScanOptions): UseRppgScanApi {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

    // ---- refs: per-frame data NEVER touches React state ----
    const phaseRef = useRef<Phase>("idle");
    useLayoutEffect(() => {
        phaseRef.current = state.phase;
    }, [state.phase]);

    const detectorRef = useRef<FaceDetector | null>(null);
    const modelStateRef = useRef<"loading" | "ready" | "fallback">("loading");
    const trackerRef = useRef(createFaceTracker());
    const samplesRef = useRef<RppgSample[]>([]);
    const activeMsRef = useRef(0);
    const rafRef = useRef(0);
    const streamRef = useRef<MediaStream | null>(null);
    const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const cameraSeqRef = useRef(0);
    const lastTickRef = useRef(0);
    const lastFrameRef = useRef(0);
    const lastCommitRef = useRef(0);
    const lastVideoTsRef = useRef(0);
    const faceSeenSinceRef = useRef(0);
    const faceLostSinceRef = useRef(0);
    const lowLightSinceRef = useRef(0);
    const motionStampsRef = useRef<number[]>([]);

    // ---- camera lifecycle (front camera for face rPPG) ----
    const stopCamera = useCallback((): void => {
        cameraSeqRef.current += 1;
        const stream = streamRef.current;
        if (stream) stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const video = videoRef.current;
        if (video) video.srcObject = null;
    }, [videoRef]);

    const startCamera = useCallback(async (): Promise<"granted" | "denied" | "unsupported"> => {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            dispatch({ type: "PERMISSION", status: "unsupported" });
            return "unsupported";
        }
        dispatch({ type: "PERMISSION", status: "requesting" });
        const seq = cameraSeqRef.current + 1;
        cameraSeqRef.current = seq;
        try {
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: "user",
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30 },
                    },
                });
            } catch {
                // Some browsers reject an exact/ideal facingMode constraint outright
                // (e.g. a single-camera desktop). Retry with a plain constraint —
                // NEVER fall back to the rear/"environment" camera.
                stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
            }
            if (cameraSeqRef.current !== seq) {
                stream.getTracks().forEach((track) => track.stop());
                return "denied";
            }
            const previous = streamRef.current;
            if (previous && previous !== stream)
                previous.getTracks().forEach((track) => track.stop());
            streamRef.current = stream;
            const video = videoRef.current;
            if (video) {
                video.srcObject = stream;
                video.muted = true;
                try {
                    await video.play();
                } catch {
                    // muted autoplay should be permitted; ignore rejection
                }
            }
            dispatch({ type: "PERMISSION", status: "granted" });
            return "granted";
        } catch {
            dispatch({ type: "PERMISSION", status: "denied" });
            return "denied";
        }
    }, [videoRef]);

    // On mount: request camera + load the face detector in parallel.
    useEffect(() => {
        let alive = true;
        void startCamera();
        void loadFaceDetector().then((detector) => {
            if (!alive) return;
            detectorRef.current = detector;
            modelStateRef.current = detector === null ? "fallback" : "ready";
            dispatch({ type: "STATUS", status: detector === null ? "model_fallback" : "ok" });
        });
        return () => {
            alive = false;
            stopCamera();
        };
    }, [startCamera, stopCamera]);

    // ---- PPG waveform drawing (canvas 2D, never React state) ----
    const drawWave = useCallback(
        (values: number[]): void => {
            const canvas = ppgCanvasRef.current;
            if (!canvas) return;
            if (canvas.width !== PPG_CANVAS_W || canvas.height !== PPG_CANVAS_H) {
                canvas.width = PPG_CANVAS_W;
                canvas.height = PPG_CANVAS_H;
            }
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, PPG_CANVAS_W, PPG_CANVAS_H);
            if (values.length < 2) return;
            let min = Number.POSITIVE_INFINITY;
            let max = Number.NEGATIVE_INFINITY;
            for (const v of values) {
                if (v < min) min = v;
                if (max < v) max = v;
            }
            const range = Math.max(max - min, 1e-6);
            const pad = 10;
            ctx.strokeStyle = WAVE_COLOR;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.beginPath();
            for (let i = 0; i < values.length; i++) {
                const x = 1 + (i / (values.length - 1)) * (PPG_CANVAS_W - 2);
                const norm = (values[i] - min) / range;
                const y = PPG_CANVAS_H - pad - norm * (PPG_CANVAS_H - pad * 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        },
        [ppgCanvasRef],
    );

    const clearWave = useCallback((): void => {
        const canvas = ppgCanvasRef.current;
        if (!canvas) return;
        if (canvas.width !== PPG_CANVAS_W || canvas.height !== PPG_CANVAS_H) {
            canvas.width = PPG_CANVAS_W;
            canvas.height = PPG_CANVAS_H;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, PPG_CANVAS_W, PPG_CANVAS_H);
    }, [ppgCanvasRef]);

    // ---- camera frame processing (throttled to ~30 fps) ----
    const processCameraFrame = useCallback(
        (now: number): { good: boolean } => {
            if (now - lastFrameRef.current < FRAME_INTERVAL_MS) return { good: false };
            lastFrameRef.current = now;
            const video = videoRef.current;
            if (!video || video.readyState < 2 || video.videoWidth === 0) return { good: false };
            let canvas = processCanvasRef.current;
            if (!canvas) {
                canvas = document.createElement("canvas");
                canvas.width = PROCESS_W;
                canvas.height = PROCESS_H;
                processCanvasRef.current = canvas;
            }
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return { good: false };
            ctx.drawImage(video, 0, 0, PROCESS_W, PROCESS_H);
            let pixels: Uint8ClampedArray;
            try {
                pixels = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H).data;
            } catch {
                return { good: false }; // tainted canvas / context loss — skip this frame
            }

            const phase = phaseRef.current;

            // --- face detection: detect once, get ROIs and motion together ---
            let faceRois: RoiRect[] = [];
            let moving = false;
            if (modelStateRef.current === "ready" && detectorRef.current !== null) {
                const ts = Math.max(now, lastVideoTsRef.current + 1); // monotonic for detectForVideo
                lastVideoTsRef.current = ts;
                const rawFace = detectFace(detectorRef.current, video, ts);
                const tracked = trackerRef.current.update(rawFace);
                if (tracked.box !== null) faceRois = foreheadCheekRoi(tracked.box);
                moving = tracked.box !== null && tracked.motion > MOTION_PER_FRAME;
            } else if (modelStateRef.current === "fallback") {
                faceRois = skinRegionRoi(pixels, PROCESS_W, PROCESS_H);
            }

            if (faceRois.length === 0) {
                if (faceLostSinceRef.current === 0) faceLostSinceRef.current = now;
                faceSeenSinceRef.current = 0;
                if (phase === "measuring" && now - faceLostSinceRef.current >= FACE_LOST_ABORT_MS) {
                    samplesRef.current = [];
                    activeMsRef.current = 0;
                    trackerRef.current.reset();
                    dispatch({ type: "ABORT_TO_POSITIONING", status: "no_face" });
                } else if (phase === "positioning") {
                    dispatch({
                        type: "STATUS",
                        status: modelStateRef.current === "loading" ? "loading_model" : "no_face",
                    });
                }
                return { good: false };
            }
            if (faceLostSinceRef.current !== 0) faceLostSinceRef.current = 0;

            // --- ROI means + brightness gate ---
            const rgb = roiMeans(pixels, PROCESS_W, PROCESS_H, faceRois);
            if (rgb === null) return { good: false };
            if (rgb.luma < MIN_LUMA) {
                if (lowLightSinceRef.current === 0) lowLightSinceRef.current = now;
                faceSeenSinceRef.current = 0;
                if (phase === "measuring" && now - lowLightSinceRef.current >= LOW_LIGHT_ABORT_MS) {
                    samplesRef.current = [];
                    activeMsRef.current = 0;
                    dispatch({ type: "ABORT_TO_POSITIONING", status: "low_light" });
                } else if (phase === "positioning") {
                    dispatch({ type: "STATUS", status: "low_light" });
                }
                return { good: false };
            }
            if (lowLightSinceRef.current !== 0) lowLightSinceRef.current = 0;

            // --- motion gate (per-frame tracker delta + 5 s moving-frame ratio) ---
            const stamps = motionStampsRef.current;
            if (moving) stamps.push(now);
            while (stamps.length > 0 && now - stamps[0] > MOTION_WINDOW_MS) stamps.shift();
            const framesInWindow = Math.max(1, Math.floor(MOTION_WINDOW_MS / FRAME_INTERVAL_MS));
            const motionRatio = stamps.length / framesInWindow;
            if (motionRatio > MAX_MOTION_RATIO) {
                faceSeenSinceRef.current = 0;
                if (phase === "measuring") {
                    samplesRef.current = [];
                    activeMsRef.current = 0;
                    stamps.length = 0;
                    trackerRef.current.reset();
                    dispatch({ type: "ABORT_TO_POSITIONING", status: "motion" });
                } else if (phase === "positioning") {
                    dispatch({ type: "STATUS", status: "motion" });
                }
                return { good: false };
            }

            // --- positioning → auto-start when the face stays put for 1 s ---
            if (phase === "positioning") {
                if (faceSeenSinceRef.current === 0) faceSeenSinceRef.current = now;
                if (now - faceSeenSinceRef.current >= FACE_PRESENT_START_MS && !moving) {
                    samplesRef.current = [];
                    activeMsRef.current = 0;
                    stamps.length = 0;
                    dispatch({ type: "START_MEASURING" });
                    return { good: true };
                }
                dispatch({ type: "STATUS", status: "ok" });
                return { good: true };
            }

            // --- measuring: accept the frame ---
            if (phase === "measuring" && !moving) {
                samplesRef.current.push({ tMs: activeMsRef.current, r: rgb.r, g: rgb.g, b: rgb.b });
            }
            return { good: !moving };
        },
        [videoRef, dispatch],
    );

    // ---- completion ----
    const finishScan = useCallback((): void => {
        const analysis = analyzeRppg(samplesRef.current);
        const result: ScanResult = {
            ...analysis,
            scanId: makeId(),
            timestamp: Date.now(),
            durationMs: SCAN_DURATION_MS,
        };
        dispatch({ type: "COMPLETED", result });
    }, [dispatch]);

    // ---- single master loop ----
    const tick = useCallback(
        (now: number): void => {
            rafRef.current = requestAnimationFrame(tick);
            const rawDt = lastTickRef.current === 0 ? 1000 / 60 : now - lastTickRef.current;
            const dt = Math.min(Math.max(rawDt, 0), 100); // clamp for tab switches / first frame
            lastTickRef.current = now;
            if (phaseRef.current === "complete") return; // keep preview, no work

            const { good } = processCameraFrame(now);

            if (phaseRef.current === "measuring" && good) {
                activeMsRef.current += dt;
                drawWave(liveWaveform(samplesRef.current, PPG_WINDOW_MS));
                if (now - lastCommitRef.current >= UI_COMMIT_INTERVAL_MS) {
                    lastCommitRef.current = now;
                    const analysis = analyzeRppg(samplesRef.current);
                    dispatch({
                        type: "SNAPSHOT",
                        progressMs: activeMsRef.current,
                        liveBpm: analysis.bpm,
                    });
                    if (analysis.bpm === null && samplesRef.current.length > MIN_SIGNAL_SAMPLES) {
                        dispatch({ type: "STATUS", status: "weak_signal" });
                    } else {
                        dispatch({ type: "STATUS", status: "ok" });
                    }
                }
                if (activeMsRef.current >= SCAN_DURATION_MS) {
                    finishScan();
                }
            }
        },
        [processCameraFrame, drawWave, finishScan],
    );

    useEffect(() => {
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(rafRef.current);
        };
    }, [tick]);

    // Entering positioning fresh: wipe all scan data + the waveform.
    useEffect(() => {
        if (state.phase !== "positioning") return;
        if (activeMsRef.current === 0 && samplesRef.current.length === 0) {
            clearWave();
        }
    }, [state.phase, clearWave]);

    // ---- actions ----
    const reset = useCallback((): void => {
        if (phaseRef.current !== "complete" && phaseRef.current !== "measuring") return;
        samplesRef.current = [];
        activeMsRef.current = 0;
        faceSeenSinceRef.current = 0;
        faceLostSinceRef.current = 0;
        lowLightSinceRef.current = 0;
        motionStampsRef.current = [];
        lastCommitRef.current = 0;
        trackerRef.current.reset();
        clearWave();
        dispatch({ type: "RESET" });
    }, [clearWave, dispatch]);

    const requestCamera = useCallback((): void => {
        if (phaseRef.current !== "idle" && phaseRef.current !== "positioning") return;
        void startCamera();
    }, [startCamera]);

    const releaseCamera = useCallback((): void => {
        stopCamera();
    }, [stopCamera]);

    const api = useMemo(
        () => ({ state, actions: { reset, requestCamera, releaseCamera } }),
        [state, reset, requestCamera, releaseCamera],
    );
    return api;
}