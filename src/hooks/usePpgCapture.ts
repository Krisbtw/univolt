import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
    useRef,
    type RefObject,
} from "react";
import { createContactGate, type ContactGate, type RgbMean } from "../lib/contactGate";
import {
    analyzeScan,
    buildDemoSamples,
    DEMO_DURATION_MS,
    type PpgSample,
    type ScanResult,
    type VitalsMetrics,
} from "../lib/signalProcessing";
import { makeId } from "../lib/vitalsDatabase";

/** Live capture duration (configurable). 12 s is genuinely too short for respiratory rate. */
export const LIVE_CAPTURE_MS = 20_000;

const FRAME_INTERVAL_MS = 1000 / 30; // throttle frame sampling to ~30 fps
const UI_COMMIT_INTERVAL_MS = 500; // numeric readouts commit to React state at most 2×/s
const CONTACT_LOST_RESET_MS = 15_000; // contact lost > 15 s → reset to idle
const PROCESS_W = 64; // downsampled frame size for pixel reads
const PROCESS_H = 48;
const PPG_WINDOW_MS = 6_000; // rolling waveform window on the canvas
const PPG_CANVAS_W = 600;
const PPG_CANVAS_H = 140;
const LIVE_WAVE_COLOR = "#34d399";
const DEMO_WAVE_COLOR = "#fbbf24";

export type Phase = "idle" | "capturing_live" | "paused" | "demo_running" | "complete";
export type PermissionStatus =
    | "undetermined"
    | "requesting"
    | "granted"
    | "denied"
    | "unsupported";
export type ScanMode = "live" | "demo";

export interface CaptureState {
    phase: Phase;
    permission: PermissionStatus;
    contact: boolean;
    mode: ScanMode | null;
    progressMs: number;
    liveMetrics: VitalsMetrics | null;
    result: ScanResult | null;
}

type Action =
    | { type: "PERMISSION"; status: PermissionStatus }
    | { type: "START_DEMO" }
    | { type: "CONTACT_GAINED" }
    | { type: "CONTACT_LOST" }
    | { type: "CONTACT_TIMEOUT" }
    | { type: "SNAPSHOT"; progressMs: number; liveMetrics: VitalsMetrics }
    | { type: "COMPLETED"; result: ScanResult }
    | { type: "RESET" };

const INITIAL_STATE: CaptureState = {
    phase: "idle",
    permission: "undetermined",
    contact: false,
    mode: null,
    progressMs: 0,
    liveMetrics: null,
    result: null,
};

/**
 * Single source of truth (bug-free contract):
 *   idle → capturing_live ⇄ paused → complete
 *   idle → demo_running → complete
 *   complete → idle (New Scan)
 * Illegal transitions are ignored (state returned unchanged), which also makes
 * double-dispatches from the rAF loop idempotent.
 */
function reducer(state: CaptureState, action: Action): CaptureState {
    switch (action.type) {
        case "PERMISSION":
            return state.permission === action.status
                ? state
                : { ...state, permission: action.status };
        case "START_DEMO":
            if (state.phase !== "idle") return state;
            return {
                ...state,
                phase: "demo_running",
                mode: "demo",
                contact: true,
                result: null,
                liveMetrics: null,
                progressMs: 0,
            };
        case "CONTACT_GAINED":
            if (state.phase === "idle") {
                return {
                    ...state,
                    phase: "capturing_live",
                    mode: "live",
                    contact: true,
                    result: null,
                    liveMetrics: null,
                    progressMs: 0,
                };
            }
            if (state.phase === "paused")
                return { ...state, phase: "capturing_live", contact: true }; // resume, keep samples
            return state;
        case "CONTACT_LOST":
            if (state.phase === "capturing_live")
                return { ...state, phase: "paused", contact: false };
            return state;
        case "CONTACT_TIMEOUT":
            if (state.phase === "paused") {
                return {
                    ...state,
                    phase: "idle",
                    contact: false,
                    mode: null,
                    liveMetrics: null,
                    progressMs: 0,
                };
            }
            return state;
        case "SNAPSHOT":
            if (state.phase !== "capturing_live" && state.phase !== "demo_running") return state;
            return { ...state, progressMs: action.progressMs, liveMetrics: action.liveMetrics };
        case "COMPLETED":
            if (state.phase !== "capturing_live" && state.phase !== "demo_running") return state;
            return {
                ...state,
                phase: "complete",
                liveMetrics: action.result,
                progressMs: action.result.durationMs,
                result: action.result,
            };
        case "RESET":
            if (state.phase === "idle") return state;
            return { ...INITIAL_STATE, permission: state.permission };
        default: {
            const exhaustive: never = action;
            return exhaustive;
        }
    }
}

export interface UsePpgCaptureOptions {
    videoRef: RefObject<HTMLVideoElement | null>;
    ppgCanvasRef: RefObject<HTMLCanvasElement | null>;
}

export interface UsePpgCaptureApi {
    state: CaptureState;
    actions: {
        startDemo: () => void;
        reset: () => void;
        requestCamera: () => void;
    };
}

export function usePpgCapture({ videoRef, ppgCanvasRef }: UsePpgCaptureOptions): UsePpgCaptureApi {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

    // ---- refs: all per-frame data. NEVER setState per frame. ----
    const phaseRef = useRef<Phase>("idle");
    const gateRef = useRef<ContactGate | null>(null);
    const samplesRef = useRef<PpgSample[]>([]);
    const demoSamplesRef = useRef<PpgSample[] | null>(null);
    const demoElapsedRef = useRef(0);
    const activeMsRef = useRef(0);
    const pauseStartRef = useRef(0);
    const lastTickRef = useRef(0);
    const lastFrameRef = useRef(0);
    const lastCommitRef = useRef(0);
    const rafRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);
    const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const cameraSeqRef = useRef(0);

    const ensureGate = useCallback((): ContactGate => {
        if (gateRef.current === null) gateRef.current = createContactGate();
        return gateRef.current;
    }, []);

    // Mirror of reducer phase for the rAF loop (layout effect runs before next paint/rAF).
    useLayoutEffect(() => {
        phaseRef.current = state.phase;
    }, [state.phase]);

    // ---- camera lifecycle ----

    const stopCamera = useCallback((): void => {
        cameraSeqRef.current += 1; // invalidate any in-flight getUserMedia request
        const stream = streamRef.current;
        if (stream) stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const video = videoRef.current;
        if (video) video.srcObject = null;
    }, [videoRef]);

    const startCamera = useCallback(async (): Promise<PermissionStatus> => {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            dispatch({ type: "PERMISSION", status: "unsupported" });
            return "unsupported";
        }
        dispatch({ type: "PERMISSION", status: "requesting" });
        const seq = cameraSeqRef.current + 1;
        cameraSeqRef.current = seq;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 },
                },
            });
            if (cameraSeqRef.current !== seq) {
                // a newer request (or unmount) won; discard this stream so nothing leaks
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

    // On launch: enter LIVE mode — request camera (preview starts after permission).
    // The synthetic generator is NEVER called on any path here.
    useEffect(() => {
        if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
            dispatch({ type: "PERMISSION", status: "unsupported" });
            return undefined;
        }
        void startCamera();
        return () => {
            stopCamera();
        };
    }, [startCamera, stopCamera]);

    // ---- PPG waveform drawing (canvas 2D, never React state) ----

    const drawWave = useCallback(
        (samples: PpgSample[], color: string): void => {
            const canvas = ppgCanvasRef.current;
            if (!canvas) return;
            if (canvas.width !== PPG_CANVAS_W || canvas.height !== PPG_CANVAS_H) {
                canvas.width = PPG_CANVAS_W;
                canvas.height = PPG_CANVAS_H;
            }
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, PPG_CANVAS_W, PPG_CANVAS_H);
            ctx.strokeStyle = "rgba(255,255,255,0.14)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, PPG_CANVAS_H / 2);
            ctx.lineTo(PPG_CANVAS_W, PPG_CANVAS_H / 2);
            ctx.stroke();
            if (samples.length < 2) return;
            const lastT = samples[samples.length - 1].tMs;
            const firstT = lastT - PPG_WINDOW_MS;
            let start = samples.length - 1;
            while (start > 0 && samples[start - 1].tMs >= firstT) start -= 1;
            if (samples.length - start < 2) return;
            let min = Number.POSITIVE_INFINITY;
            let max = Number.NEGATIVE_INFINITY;
            for (let i = start; i < samples.length; i++) {
                const v = samples[i].red;
                if (v < min) min = v;
                if (max < v) max = v;
            }
            const range = Math.max(max - min, 2);
            const spanT = Math.max(samples[samples.length - 1].tMs - samples[start].tMs, 1);
            const pad = 10;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.beginPath();
            for (let i = start; i < samples.length; i++) {
                const s = samples[i];
                const x = 1 + ((s.tMs - samples[start].tMs) / spanT) * (PPG_CANVAS_W - 2);
                const norm = (s.red - min) / range;
                const y = PPG_CANVAS_H - pad - norm * (PPG_CANVAS_H - pad * 2);
                if (i === start) ctx.moveTo(x, y);
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
        (now: number): void => {
            if (now - lastFrameRef.current < FRAME_INTERVAL_MS) return;
            lastFrameRef.current = now;
            const video = videoRef.current;
            if (!video || video.readyState < 2 || video.videoWidth === 0) return;
            let canvas = processCanvasRef.current;
            if (!canvas) {
                canvas = document.createElement("canvas");
                canvas.width = PROCESS_W;
                canvas.height = PROCESS_H;
                processCanvasRef.current = canvas;
            }
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(video, 0, 0, PROCESS_W, PROCESS_H);
            let pixels: Uint8ClampedArray;
            try {
                pixels = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H).data;
            } catch {
                return; // tainted canvas / context loss — skip this frame
            }
            // Center region: middle half in each dimension ≈ 25% of frame area.
            const x0 = Math.floor(PROCESS_W / 4);
            const x1 = PROCESS_W - x0;
            const y0 = Math.floor(PROCESS_H / 4);
            const y1 = PROCESS_H - y0;
            let rSum = 0;
            let gSum = 0;
            let bSum = 0;
            let count = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const idx = (y * PROCESS_W + x) * 4;
                    rSum += pixels[idx];
                    gSum += pixels[idx + 1];
                    bSum += pixels[idx + 2];
                    count += 1;
                }
            }
            if (count === 0) return;
            const rgb: RgbMean = { r: rSum / count, g: gSum / count, b: bSum / count };

            const gate = ensureGate();
            const update = gate.update(rgb);
            const phase = phaseRef.current;
            if (update.justGained) {
                if (phase === "idle") {
                    activeMsRef.current = 0;
                    samplesRef.current = [];
                    dispatch({ type: "CONTACT_GAINED" }); // idle → capturing_live
                } else if (phase === "paused") {
                    dispatch({ type: "CONTACT_GAINED" }); // paused → capturing_live (resume, keep samples)
                }
            } else if (update.justLost && phase === "capturing_live") {
                pauseStartRef.current = now;
                dispatch({ type: "CONTACT_LOST" }); // capturing_live → paused (samples kept)
            }
            if (phase === "capturing_live" && update.isContact) {
                // tMs is ACTIVE time (accumulated only while in contact), so pauses
                // never create gaps in the sample timeline.
                samplesRef.current.push({ tMs: activeMsRef.current, red: rgb.r, green: rgb.g });
            }
        },
        [videoRef, ensureGate, dispatch],
    );

    // ---- completion ----

    const finishScan = useCallback((): void => {
        const phase = phaseRef.current;
        if (phase !== "capturing_live" && phase !== "demo_running") return;
        const isDemo = phase === "demo_running";
        const samples = isDemo ? (demoSamplesRef.current ?? []) : samplesRef.current;
        const metrics = analyzeScan(samples); // same pipeline for live and demo
        const result: ScanResult = {
            scanId: makeId(),
            mode: isDemo ? "demo" : "live",
            durationMs: isDemo ? DEMO_DURATION_MS : LIVE_CAPTURE_MS,
            timestamp: Date.now(),
            bpm: metrics.bpm,
            hrv: metrics.hrv,
            spo2: metrics.spo2,
            rr: metrics.rr,
        };
        dispatch({ type: "COMPLETED", result });
    }, [dispatch]);

    const revealDemoSamples = useCallback((elapsedMs: number): PpgSample[] => {
        const all = demoSamplesRef.current;
        if (!all || all.length === 0) return [];
        let cut = all.length;
        while (cut > 0 && all[cut - 1].tMs > elapsedMs) cut -= 1;
        return all.slice(0, cut);
    }, []);

    // ---- single master loop: demo generator and camera processing are mutually exclusive ----

    const tick = useCallback(
        (now: number): void => {
            rafRef.current = requestAnimationFrame(tick);
            const rawDt = lastTickRef.current === 0 ? 1000 / 60 : now - lastTickRef.current;
            const dt = Math.min(Math.max(rawDt, 0), 100); // clamp for tab switches / first frame
            lastTickRef.current = now;
            const phase = phaseRef.current;

            // DEMO: the ONLY place the synthetic signal can advance. Camera frame
            // processing is suspended while demo runs (we return before it).
            if (phase === "demo_running") {
                demoElapsedRef.current += dt;
                const elapsed = demoElapsedRef.current;
                const revealed = revealDemoSamples(elapsed);
                drawWave(revealed, DEMO_WAVE_COLOR);
                if (now - lastCommitRef.current >= UI_COMMIT_INTERVAL_MS) {
                    lastCommitRef.current = now;
                    dispatch({
                        type: "SNAPSHOT",
                        progressMs: elapsed,
                        liveMetrics: analyzeScan(revealed),
                    });
                }
                if (elapsed >= DEMO_DURATION_MS) finishScan();
                return;
            }

            // LIVE: camera frames + contact gate (idle auto-start, paused monitors for regain).
            if (phase === "idle" || phase === "capturing_live" || phase === "paused") {
                processCameraFrame(now);
                if (phase === "capturing_live") {
                    const gate = gateRef.current;
                    const contact = gate !== null && gate.isContact;
                    if (contact) {
                        activeMsRef.current += dt;
                        if (activeMsRef.current >= LIVE_CAPTURE_MS) {
                            finishScan();
                            return;
                        }
                    }
                    drawWave(samplesRef.current, LIVE_WAVE_COLOR);
                    if (now - lastCommitRef.current >= UI_COMMIT_INTERVAL_MS) {
                        lastCommitRef.current = now;
                        dispatch({
                            type: "SNAPSHOT",
                            progressMs: activeMsRef.current,
                            liveMetrics: analyzeScan(samplesRef.current),
                        });
                    }
                } else if (
                    phase === "paused" &&
                    now - pauseStartRef.current >= CONTACT_LOST_RESET_MS
                ) {
                    dispatch({ type: "CONTACT_TIMEOUT" }); // > 15 s without contact → idle
                }
            }
            // 'complete': loop keeps scheduling but does no work — no leaked timers.
        },
        [processCameraFrame, finishScan, revealDemoSamples, drawWave, dispatch],
    );

    useEffect(() => {
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(rafRef.current);
        };
    }, [tick]);

    // Entering idle: clear all scan data, reset the gate (so a still-placed finger
    // re-triggers a fresh justGained edge) and wipe the waveform.
    useEffect(() => {
        if (state.phase !== "idle") return;
        samplesRef.current = [];
        activeMsRef.current = 0;
        demoSamplesRef.current = null;
        demoElapsedRef.current = 0;
        pauseStartRef.current = 0;
        lastCommitRef.current = 0;
        gateRef.current?.reset();
        clearWave();
    }, [state.phase, clearWave]);

    // ---- actions ----

    const startDemo = useCallback((): void => {
        if (phaseRef.current !== "idle") return; // visible/enabled only while idle
        samplesRef.current = [];
        activeMsRef.current = 0;
        demoSamplesRef.current = buildDemoSamples(); // generator runs ONLY on this explicit click
        demoElapsedRef.current = 0;
        lastCommitRef.current = 0;
        lastFrameRef.current = 0;
        clearWave();
        dispatch({ type: "START_DEMO" });
    }, [dispatch, clearWave]);

    const reset = useCallback((): void => {
        if (phaseRef.current === "idle") return;
        clearWave();
        dispatch({ type: "RESET" }); // idle-effect above clears samples/timers/gate
    }, [dispatch, clearWave]);

    const requestCamera = useCallback((): void => {
        void startCamera();
    }, [startCamera]);

    const actions = useMemo(
        () => ({ startDemo, reset, requestCamera }),
        [startDemo, reset, requestCamera],
    );

    return { state, actions };
}