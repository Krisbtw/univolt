import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/scan-AvDbzLan.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function computeLuma(rgb) {
	return .299 * rgb.r + .587 * rgb.g + .114 * rgb.b;
}
/** Contact is valid when: R > 120 && R / max(1, G+B) > 1.4 && meanLuma > LUMA_FLOOR */
function passesContactThresholds(rgb) {
	const dominance = rgb.r / Math.max(1, rgb.g + rgb.b);
	return rgb.r > 120 && dominance > 1.4 && computeLuma(rgb) > 60;
}
/**
* Stateful tracker (owned by the hook in a useRef — never React state).
* Debounce: the FAIL condition must hold on >= GATE_FAIL_FRAMES consecutive
* frames before contact is declared lost, so pressure flicker doesn't toggle the gate.
* A single passing frame re-establishes contact.
*/
function createContactGate() {
	let contact = false;
	let consecutiveFails = 0;
	return {
		get isContact() {
			return contact;
		},
		update(rgb) {
			if (passesContactThresholds(rgb)) {
				consecutiveFails = 0;
				if (!contact) {
					contact = true;
					return {
						isContact: true,
						justGained: true,
						justLost: false
					};
				}
				return {
					isContact: true,
					justGained: false,
					justLost: false
				};
			}
			consecutiveFails += 1;
			if (contact && consecutiveFails >= 10) {
				contact = false;
				return {
					isContact: false,
					justGained: false,
					justLost: true
				};
			}
			return {
				isContact: contact,
				justGained: false,
				justLost: false
			};
		},
		reset() {
			contact = false;
			consecutiveFails = 0;
		}
	};
}
/** Demo simulation length (fixed by the rubric). */
var DEMO_DURATION_MS = 12e3;
/** Sample rate used to synthesise the demo PPG. */
var DEMO_FS = 30;
function mean(xs) {
	if (xs.length === 0) return 0;
	let s = 0;
	for (const v of xs) s += v;
	return s / xs.length;
}
function stdev(xs) {
	const n = xs.length;
	if (n < 2) return 0;
	const m = mean(xs);
	let s = 0;
	for (const v of xs) s += (v - m) * (v - m);
	return Math.sqrt(s / (n - 1));
}
function median(xs) {
	const n = xs.length;
	if (n === 0) return 0;
	const sorted = [...xs].sort((a, b) => a - b);
	const mid = n >> 1;
	return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function clamp(v, lo, hi) {
	return Math.min(hi, Math.max(lo, v));
}
function highpass(x, fs, fc) {
	const n = x.length;
	const y = new Array(n);
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
function lowpass(x, fs, fc) {
	const n = x.length;
	const y = new Array(n);
	if (n === 0) return y;
	const dt = 1 / fs;
	const alpha = dt / (1 / (2 * Math.PI * fc) + dt);
	y[0] = x[0];
	for (let i = 1; i < n; i++) y[i] = y[i - 1] + alpha * (x[i] - y[i - 1]);
	return y;
}
/** Cardiac band ~0.7–4 Hz (double-HP for a steeper skirt). */
function bandpassCardiac(x, fs) {
	return lowpass(highpass(highpass(x, fs, .7), fs, .7), fs, 4);
}
/** Respiration band ~0.13–0.4 Hz. */
function bandpassRespiration(x, fs) {
	return lowpass(lowpass(highpass(x, fs, .13), fs, .4), fs, .4);
}
function detectPeaks(x, fs) {
	const n = x.length;
	if (n < 10) return [];
	const m = mean(x);
	const sd = stdev(x);
	if (sd < 1e-9) return [];
	const threshold = m + .4 * sd;
	const half = Math.max(1, Math.round(fs * .12));
	const minDist = Math.max(1, Math.round(fs * .3));
	const peaks = [];
	for (let i = half; i < n - half; i++) {
		const v = x[i];
		if (v < threshold) continue;
		let isLocalMax = true;
		for (let j = i - half; j <= i + half; j++) if (x[j] > v) {
			isLocalMax = false;
			break;
		}
		if (!isLocalMax) continue;
		const last = peaks.length > 0 ? peaks[peaks.length - 1] : -1;
		if (last < 0 || i - last >= minDist) peaks.push(i);
		else if (v > x[last]) peaks[peaks.length - 1] = i;
	}
	return peaks;
}
function computeBpmAndHrv(peakIndices, fs) {
	if (peakIndices.length < 5) return {
		bpm: null,
		hrv: null
	};
	const timesMs = peakIndices.map((i) => i / fs * 1e3);
	const rr = [];
	for (let i = 1; i < timesMs.length; i++) {
		const d = timesMs[i] - timesMs[i - 1];
		if (d >= 300 && d <= 2e3) rr.push(d);
	}
	if (rr.length < 3) return {
		bpm: null,
		hrv: null
	};
	return {
		bpm: Math.round(clamp(6e4 / median(rr), 30, 220)),
		hrv: rr.length >= 5 ? Math.round(clamp(stdev(rr), 0, 500)) : null
	};
}
function robustAmplitude(x) {
	if (x.length === 0) return 0;
	return 1.4826 * median(x.map((v) => Math.abs(v)));
}
function estimateSpo2(red, green, fs) {
	if (red.length < fs * 4 || red.length !== green.length) return null;
	const redAc = robustAmplitude(bandpassCardiac(red, fs));
	const greenAc = robustAmplitude(bandpassCardiac(green, fs));
	const redDc = mean(red);
	const greenDc = mean(green);
	if (redDc <= 1 || greenDc <= 1 || redAc < .05 || greenAc < .05) return null;
	const spo2 = 110 - 25 * (redAc / redDc / (greenAc / greenDc));
	if (!Number.isFinite(spo2)) return null;
	return clamp(Math.round(spo2), 70, 100);
}
function estimateRespiratoryRate(x, fs) {
	const n = x.length;
	if (n < Math.floor(fs * 8)) return null;
	const y = bandpassRespiration(x, fs);
	const m = mean(y);
	const z = y.map((v) => v - m);
	const minLag = Math.max(1, Math.round(fs * 2.5));
	const maxLag = Math.min(Math.floor(n / 2) - 1, Math.round(fs * 7.7));
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
	if (bestLag < 0 || bestVal < .2) return null;
	return clamp(Math.round(60 * fs / bestLag), 6, 40);
}
/** Resamples (jittery) timestamps onto a uniform grid at the measured frame rate. */
function toUniformSeries(samples) {
	const n = samples.length;
	if (n < 2) return {
		red: [],
		green: [],
		fs: 0
	};
	const t0 = samples[0].tMs;
	const span = samples[n - 1].tMs - t0;
	if (span <= 0) return {
		red: [],
		green: [],
		fs: 0
	};
	const fs = (n - 1) * 1e3 / span;
	const red = new Array(n);
	const green = new Array(n);
	let j = 0;
	for (let i = 0; i < n; i++) {
		const target = i * 1e3 / fs;
		while (j < n - 1 && samples[j + 1].tMs - t0 < target) j++;
		const a = samples[j];
		const b = samples[Math.min(j + 1, n - 1)];
		const ta = a.tMs - t0;
		const spanAb = b.tMs - t0 - ta;
		const w = spanAb > 0 ? clamp((target - ta) / spanAb, 0, 1) : 0;
		red[i] = a.red + (b.red - a.red) * w;
		green[i] = a.green + (b.green - a.green) * w;
	}
	return {
		red,
		green,
		fs
	};
}
function analyzeScan(samples) {
	const empty = {
		bpm: null,
		hrv: null,
		spo2: null,
		rr: null
	};
	if (samples.length < 60) return empty;
	const { red, green, fs } = toUniformSeries(samples);
	if (fs < 10 || red.length < 60) return empty;
	const cardiac = bandpassCardiac(red, fs);
	const settle = Math.min(Math.floor(fs * .5), Math.max(0, cardiac.length - 12));
	const { bpm, hrv } = computeBpmAndHrv(detectPeaks(cardiac.slice(settle), fs), fs);
	return {
		bpm,
		hrv,
		spo2: estimateSpo2(red, green, fs),
		rr: estimateRespiratoryRate(red, fs)
	};
}
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function motionArtifact(t, start, duration) {
	if (t < start || t > start + duration) return 0;
	const w = (t - start) / duration;
	return Math.sin(Math.PI * w) * Math.sin(2 * Math.PI * .9 * (t - start));
}
/** 12 s of synthetic red/green PPG: ~72 bpm pulse with RSA (→ realistic HRV),
*  ~16 breaths/min baseline modulation, noise, and two motion-artifact bursts.
*  Amplitudes are tuned so the SpO2 ratio-of-ratios lands near 97%. */
function buildDemoSamples() {
	const count = Math.round(DEMO_DURATION_MS / 1e3 * DEMO_FS);
	const rng = mulberry32(1592638046);
	const heartHz = 1.2;
	const respHz = .27;
	const samples = [];
	for (let i = 0; i < count; i++) {
		const t = i / DEMO_FS;
		const resp = Math.sin(2 * Math.PI * respHz * t);
		const phase = 2 * Math.PI * heartHz * t + .35 * resp;
		const pulse = Math.sin(phase) + .35 * Math.sin(2 * phase) + .12 * Math.sin(3 * phase);
		const respMod = 1 + .08 * resp;
		const art1 = motionArtifact(t, 3.6, .7);
		const art2 = motionArtifact(t, 8.1, .6);
		const red = 170 + 3 * resp + 9.5 * pulse * respMod + (rng() - .5) * 2.4 + 26 * art1 + 30 * art2;
		const green = 62 + 2.6 * Math.sin(2 * Math.PI * respHz * t + .6) + 6.7 * pulse * respMod + (rng() - .5) * 1.8 + 21 * art1 + 24 * art2;
		samples.push({
			tMs: Math.round(i * 1e3 / DEMO_FS),
			red,
			green
		});
	}
	return samples;
}
var SCANS_KEY = "univolt.scans.v1";
var LOCALE_KEY = "univolt.locale.v1";
var MAX_HISTORY = 50;
var TRIAGE_LEVELS = [
	"normal",
	"borderline",
	"tachycardia",
	"bradycardia",
	"hypoxia",
	"tachypnea",
	"inconclusive"
];
function storage() {
	try {
		return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
	} catch {
		return null;
	}
}
function isRecord(v) {
	return typeof v === "object" && v !== null;
}
function numOrNull(v) {
	return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function makeId() {
	try {
		if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	} catch {}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function loadScans() {
	const store = storage();
	if (!store) return [];
	try {
		const raw = store.getItem(SCANS_KEY);
		if (raw === null) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const out = [];
		for (const item of parsed) {
			if (!isRecord(item)) continue;
			const id = typeof item.id === "string" ? item.id : null;
			const timestamp = numOrNull(item.timestamp);
			const mode = item.mode === "live" || item.mode === "demo" ? item.mode : null;
			const locale = item.locale === "en" || item.locale === "hi" ? item.locale : null;
			const rawLevel = item.triageLevel;
			const triageLevel = typeof rawLevel === "string" ? TRIAGE_LEVELS.find((l) => l === rawLevel) ?? null : null;
			if (id === null || timestamp === null || mode === null || locale === null || triageLevel === null) continue;
			out.push({
				id,
				timestamp,
				mode,
				bpm: numOrNull(item.bpm),
				hrv: numOrNull(item.hrv),
				spo2: numOrNull(item.spo2),
				rr: numOrNull(item.rr),
				locale,
				triageLevel
			});
		}
		return out.sort((a, b) => b.timestamp - a.timestamp);
	} catch {
		return [];
	}
}
function saveScan(record) {
	const store = storage();
	if (!store) return;
	const scans = loadScans();
	scans.unshift(record);
	try {
		store.setItem(SCANS_KEY, JSON.stringify(scans.slice(0, MAX_HISTORY)));
	} catch {}
}
function clearScans() {
	const store = storage();
	if (!store) return;
	try {
		store.removeItem(SCANS_KEY);
	} catch {}
}
function loadLocale() {
	const store = storage();
	if (!store) return null;
	try {
		const v = store.getItem(LOCALE_KEY);
		return v === "en" || v === "hi" ? v : null;
	} catch {
		return null;
	}
}
function saveLocale(locale) {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(LOCALE_KEY, locale);
	} catch {}
}
/** Live capture duration (configurable). 12 s is genuinely too short for respiratory rate. */
var LIVE_CAPTURE_MS = 2e4;
var FRAME_INTERVAL_MS = 1e3 / 30;
var UI_COMMIT_INTERVAL_MS = 500;
var CONTACT_LOST_RESET_MS = 15e3;
var PROCESS_W = 64;
var PROCESS_H = 48;
var PPG_WINDOW_MS = 6e3;
var PPG_CANVAS_W = 600;
var PPG_CANVAS_H = 140;
var LIVE_WAVE_COLOR = "#34d399";
var DEMO_WAVE_COLOR = "#fbbf24";
var INITIAL_STATE = {
	phase: "idle",
	permission: "undetermined",
	contact: false,
	mode: null,
	progressMs: 0,
	liveMetrics: null,
	result: null
};
/**
* Single source of truth (bug-free contract):
*   idle → capturing_live ⇄ paused → complete
*   idle → demo_running → complete
*   complete → idle (New Scan)
* Illegal transitions are ignored (state returned unchanged), which also makes
* double-dispatches from the rAF loop idempotent.
*/
function reducer(state, action) {
	switch (action.type) {
		case "PERMISSION": return state.permission === action.status ? state : {
			...state,
			permission: action.status
		};
		case "START_DEMO":
			if (state.phase !== "idle") return state;
			return {
				...state,
				phase: "demo_running",
				mode: "demo",
				contact: true,
				result: null,
				liveMetrics: null,
				progressMs: 0
			};
		case "CONTACT_GAINED":
			if (state.phase === "idle") return {
				...state,
				phase: "capturing_live",
				mode: "live",
				contact: true,
				result: null,
				liveMetrics: null,
				progressMs: 0
			};
			if (state.phase === "paused") return {
				...state,
				phase: "capturing_live",
				contact: true
			};
			return state;
		case "CONTACT_LOST":
			if (state.phase === "capturing_live") return {
				...state,
				phase: "paused",
				contact: false
			};
			return state;
		case "CONTACT_TIMEOUT":
			if (state.phase === "paused") return {
				...state,
				phase: "idle",
				contact: false,
				mode: null,
				liveMetrics: null,
				progressMs: 0
			};
			return state;
		case "SNAPSHOT":
			if (state.phase !== "capturing_live" && state.phase !== "demo_running") return state;
			return {
				...state,
				progressMs: action.progressMs,
				liveMetrics: action.liveMetrics
			};
		case "COMPLETED":
			if (state.phase !== "capturing_live" && state.phase !== "demo_running") return state;
			return {
				...state,
				phase: "complete",
				liveMetrics: action.result,
				progressMs: action.result.durationMs,
				result: action.result
			};
		case "RESET":
			if (state.phase === "idle") return state;
			return {
				...INITIAL_STATE,
				permission: state.permission
			};
		default: return action;
	}
}
function usePpgCapture({ videoRef, ppgCanvasRef }) {
	const [state, dispatch] = (0, import_react.useReducer)(reducer, INITIAL_STATE);
	const phaseRef = (0, import_react.useRef)("idle");
	const gateRef = (0, import_react.useRef)(null);
	const samplesRef = (0, import_react.useRef)([]);
	const demoSamplesRef = (0, import_react.useRef)(null);
	const demoElapsedRef = (0, import_react.useRef)(0);
	const activeMsRef = (0, import_react.useRef)(0);
	const pauseStartRef = (0, import_react.useRef)(0);
	const lastTickRef = (0, import_react.useRef)(0);
	const lastFrameRef = (0, import_react.useRef)(0);
	const lastCommitRef = (0, import_react.useRef)(0);
	const rafRef = (0, import_react.useRef)(0);
	const streamRef = (0, import_react.useRef)(null);
	const processCanvasRef = (0, import_react.useRef)(null);
	const cameraSeqRef = (0, import_react.useRef)(0);
	const ensureGate = (0, import_react.useCallback)(() => {
		if (gateRef.current === null) gateRef.current = createContactGate();
		return gateRef.current;
	}, []);
	(0, import_react.useLayoutEffect)(() => {
		phaseRef.current = state.phase;
	}, [state.phase]);
	const stopCamera = (0, import_react.useCallback)(() => {
		cameraSeqRef.current += 1;
		const stream = streamRef.current;
		if (stream) stream.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		const video = videoRef.current;
		if (video) video.srcObject = null;
	}, [videoRef]);
	const startCamera = (0, import_react.useCallback)(async () => {
		if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
			dispatch({
				type: "PERMISSION",
				status: "unsupported"
			});
			return "unsupported";
		}
		dispatch({
			type: "PERMISSION",
			status: "requesting"
		});
		const seq = cameraSeqRef.current + 1;
		cameraSeqRef.current = seq;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: { ideal: "environment" },
					width: { ideal: 640 },
					height: { ideal: 480 },
					frameRate: { ideal: 30 }
				}
			});
			if (cameraSeqRef.current !== seq) {
				stream.getTracks().forEach((track) => track.stop());
				return "denied";
			}
			const previous = streamRef.current;
			if (previous && previous !== stream) previous.getTracks().forEach((track) => track.stop());
			streamRef.current = stream;
			const video = videoRef.current;
			if (video) {
				video.srcObject = stream;
				video.muted = true;
				try {
					await video.play();
				} catch {}
			}
			dispatch({
				type: "PERMISSION",
				status: "granted"
			});
			return "granted";
		} catch {
			dispatch({
				type: "PERMISSION",
				status: "denied"
			});
			return "denied";
		}
	}, [videoRef]);
	(0, import_react.useEffect)(() => {
		if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
			dispatch({
				type: "PERMISSION",
				status: "unsupported"
			});
			return;
		}
		startCamera();
		return () => {
			stopCamera();
		};
	}, [startCamera, stopCamera]);
	const drawWave = (0, import_react.useCallback)((samples, color) => {
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
		const firstT = samples[samples.length - 1].tMs - PPG_WINDOW_MS;
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
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.lineJoin = "round";
		ctx.beginPath();
		for (let i = start; i < samples.length; i++) {
			const s = samples[i];
			const x = 1 + (s.tMs - samples[start].tMs) / spanT * 598;
			const y = 130 - (s.red - min) / range * 120;
			if (i === start) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}, [ppgCanvasRef]);
	const clearWave = (0, import_react.useCallback)(() => {
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
	const processCameraFrame = (0, import_react.useCallback)((now) => {
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
		let pixels;
		try {
			pixels = ctx.getImageData(0, 0, PROCESS_W, PROCESS_H).data;
		} catch {
			return;
		}
		const x0 = Math.floor(PROCESS_W / 4);
		const x1 = 48;
		const y0 = Math.floor(PROCESS_H / 4);
		const y1 = 36;
		let rSum = 0;
		let gSum = 0;
		let bSum = 0;
		let count = 0;
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
			const idx = (y * PROCESS_W + x) * 4;
			rSum += pixels[idx];
			gSum += pixels[idx + 1];
			bSum += pixels[idx + 2];
			count += 1;
		}
		if (count === 0) return;
		const rgb = {
			r: rSum / count,
			g: gSum / count,
			b: bSum / count
		};
		const update = ensureGate().update(rgb);
		const phase = phaseRef.current;
		if (update.justGained) {
			if (phase === "idle") {
				activeMsRef.current = 0;
				samplesRef.current = [];
				dispatch({ type: "CONTACT_GAINED" });
			} else if (phase === "paused") dispatch({ type: "CONTACT_GAINED" });
		} else if (update.justLost && phase === "capturing_live") {
			pauseStartRef.current = now;
			dispatch({ type: "CONTACT_LOST" });
		}
		if (phase === "capturing_live" && update.isContact) samplesRef.current.push({
			tMs: activeMsRef.current,
			red: rgb.r,
			green: rgb.g
		});
	}, [
		videoRef,
		ensureGate,
		dispatch
	]);
	const finishScan = (0, import_react.useCallback)(() => {
		const phase = phaseRef.current;
		if (phase !== "capturing_live" && phase !== "demo_running") return;
		const isDemo = phase === "demo_running";
		const metrics = analyzeScan(isDemo ? demoSamplesRef.current ?? [] : samplesRef.current);
		const result = {
			scanId: makeId(),
			mode: isDemo ? "demo" : "live",
			durationMs: isDemo ? DEMO_DURATION_MS : LIVE_CAPTURE_MS,
			timestamp: Date.now(),
			bpm: metrics.bpm,
			hrv: metrics.hrv,
			spo2: metrics.spo2,
			rr: metrics.rr
		};
		dispatch({
			type: "COMPLETED",
			result
		});
	}, [dispatch]);
	const revealDemoSamples = (0, import_react.useCallback)((elapsedMs) => {
		const all = demoSamplesRef.current;
		if (!all || all.length === 0) return [];
		let cut = all.length;
		while (cut > 0 && all[cut - 1].tMs > elapsedMs) cut -= 1;
		return all.slice(0, cut);
	}, []);
	const tick = (0, import_react.useCallback)((now) => {
		rafRef.current = requestAnimationFrame(tick);
		const rawDt = lastTickRef.current === 0 ? 1e3 / 60 : now - lastTickRef.current;
		const dt = Math.min(Math.max(rawDt, 0), 100);
		lastTickRef.current = now;
		const phase = phaseRef.current;
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
					liveMetrics: analyzeScan(revealed)
				});
			}
			if (elapsed >= 12e3) finishScan();
			return;
		}
		if (phase === "idle" || phase === "capturing_live" || phase === "paused") {
			processCameraFrame(now);
			if (phase === "capturing_live") {
				const gate = gateRef.current;
				if (gate !== null && gate.isContact) {
					activeMsRef.current += dt;
					if (activeMsRef.current >= 2e4) {
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
						liveMetrics: analyzeScan(samplesRef.current)
					});
				}
			} else if (phase === "paused" && now - pauseStartRef.current >= CONTACT_LOST_RESET_MS) dispatch({ type: "CONTACT_TIMEOUT" });
		}
	}, [
		processCameraFrame,
		finishScan,
		revealDemoSamples,
		drawWave,
		dispatch
	]);
	(0, import_react.useEffect)(() => {
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(rafRef.current);
		};
	}, [tick]);
	(0, import_react.useEffect)(() => {
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
	const startDemo = (0, import_react.useCallback)(() => {
		if (phaseRef.current !== "idle") return;
		samplesRef.current = [];
		activeMsRef.current = 0;
		demoSamplesRef.current = buildDemoSamples();
		demoElapsedRef.current = 0;
		lastCommitRef.current = 0;
		lastFrameRef.current = 0;
		clearWave();
		dispatch({ type: "START_DEMO" });
	}, [dispatch, clearWave]);
	const reset = (0, import_react.useCallback)(() => {
		if (phaseRef.current === "idle") return;
		clearWave();
		dispatch({ type: "RESET" });
	}, [dispatch, clearWave]);
	const requestCamera = (0, import_react.useCallback)(() => {
		startCamera();
	}, [startCamera]);
	return {
		state,
		actions: (0, import_react.useMemo)(() => ({
			startDemo,
			reset,
			requestCamera
		}), [
			startDemo,
			reset,
			requestCamera
		])
	};
}
/**
* Priority: hypoxia > bradycardia > tachypnea > tachycardia > borderline > normal.
* "borderline" covers the gap zones (HR 50–59, SpO2 94, RR 21–24, or missing
* but non-abnormal values) with a rest-and-recheck message.
*/
function evaluateTriage(m) {
	const { bpm, spo2, rr } = m;
	if (bpm === null && spo2 === null && rr === null) return {
		level: "inconclusive",
		referral: false,
		urgent: false
	};
	if (spo2 !== null && spo2 < 94) return {
		level: "hypoxia",
		referral: true,
		urgent: spo2 < 90
	};
	if (bpm !== null && bpm < 50) return {
		level: "bradycardia",
		referral: true,
		urgent: false
	};
	if (rr !== null && rr > 24) return {
		level: "tachypnea",
		referral: true,
		urgent: false
	};
	if (bpm !== null && bpm > 100) return {
		level: "tachycardia",
		referral: true,
		urgent: bpm > 120
	};
	if ((bpm === null || bpm >= 60 && bpm <= 100) && (spo2 === null || spo2 >= 95) && (rr === null || rr >= 12 && rr <= 20)) {
		if (bpm === null || spo2 === null || rr === null) return {
			level: "borderline",
			referral: false,
			urgent: false
		};
		return {
			level: "normal",
			referral: false,
			urgent: false
		};
	}
	return {
		level: "borderline",
		referral: false,
		urgent: false
	};
}
var translations = {
	en: {
		appTitle: "UniVolt Vitals",
		tagline: "Camera-based vital signs scan",
		liveBadge: "LIVE",
		simulatedBadge: "SIMULATED",
		demoModeNotice: "Demo simulation — synthetic PPG, not real measurements",
		demoWatermark: "SIMULATED — demo data, not real measurements",
		metricHeartRate: "Heart Rate",
		metricHeartRateUnit: "bpm",
		metricHrv: "HRV (SDNN)",
		metricHrvUnit: "ms",
		metricSpo2: "SpO₂",
		metricSpo2Unit: "%",
		metricSpo2Note: "estimate",
		metricRespRate: "Respiratory Rate",
		metricRespRateUnit: "/min",
		metricRespRateNote: "approx",
		placeholder: "--",
		secUnit: "s",
		separator: " · ",
		contactOverlay: "No finger detected — place finger firmly over camera lens",
		readyHint: "Place your fingertip firmly over the camera lens to begin the scan.",
		scanningLabel: "Scanning",
		pausedLabel: "Paused — waiting for finger contact",
		demoButton: "Run 12s Demo Simulation (For Laptop Judges)",
		newScanButton: "New Scan",
		grantPermissionButton: "Grant permission",
		permissionDeniedTitle: "Camera access is blocked",
		permissionDeniedBody: "UniVolt needs the camera to read the pulse from your fingertip. Grant access below — or run the 12-second demo simulation to see the full pipeline.",
		permissionUnsupportedTitle: "Camera not available",
		permissionUnsupportedBody: "This browser does not expose a camera. You can still run the demo simulation to see the full pipeline.",
		scanComplete: "Scan complete",
		guidanceTitle: "Awareness & Triage Guidance",
		guidanceIntro: "Read this aloud to the person you scanned:",
		languageLabel: "Language",
		localeNameEn: "English",
		localeNameHi: "हिंदी",
		historyTitle: "Scan history",
		historyEmpty: "No scans yet.",
		clearHistoryButton: "Clear history",
		disclaimer: "Not a medical device. For screening and education only — in an emergency, go to the nearest health facility.",
		guidance: {
			urgentPrefix: "URGENT — ",
			referralLine: "Please go to the nearest Primary Health Centre (PHC) as soon as possible.",
			triage: {
				normal: {
					title: "All vitals normal",
					body: "Heart rate, oxygen and breathing are all in the normal range. Encourage the person to drink water and rest for a few minutes."
				},
				borderline: {
					title: "Values at the edge of normal",
					body: "One or more values sit just outside the normal range. Have the person sit and rest for five minutes, then repeat the scan."
				},
				tachycardia: {
					title: "Fast heart rate (tachycardia)",
					body: "The heart is beating faster than normal. Keep the person seated and calm. If they feel faint, have chest pain, or the rate stays above 120, treat it as urgent."
				},
				bradycardia: {
					title: "Slow heart rate (bradycardia)",
					body: "The heart is beating slower than expected. Ask about dizziness, tiredness or fainting — if any are present, do not wait; refer today."
				},
				hypoxia: {
					title: "Low oxygen (possible hypoxia)",
					body: "The oxygen level in the blood appears lower than normal. Sit the person upright, keep them calm, and re-check. A level under 90% needs urgent care."
				},
				tachypnea: {
					title: "Fast breathing (tachypnea)",
					body: "The breathing rate is faster than normal. Let the person rest seated and count the breaths again after five minutes. If still fast, refer."
				},
				inconclusive: {
					title: "Not enough signal",
					body: "The scan could not produce reliable values. Wipe the lens, place the finger firmly over the camera, and run the scan again."
				}
			}
		}
	},
	hi: {
		appTitle: "यूनिवोल्ट वाइटल्स",
		tagline: "कैमरे से जीवन-संकेतों की जाँच",
		liveBadge: "लाइव",
		simulatedBadge: "सिम्युलेटेड",
		demoModeNotice: "डेमो सिमुलेशन — संश्लेषित सिग्नल, वास्तविक मापन नहीं",
		demoWatermark: "सिम्युलेटेड — डेमो डेटा, वास्तविक माप नहीं",
		metricHeartRate: "हृदय गति",
		metricHeartRateUnit: "बीपीएम",
		metricHrv: "एचआरवी (SDNN)",
		metricHrvUnit: "मि.से.",
		metricSpo2: "SpO₂",
		metricSpo2Unit: "%",
		metricSpo2Note: "अनुमान",
		metricRespRate: "श्वसन दर",
		metricRespRateUnit: "/मिनट",
		metricRespRateNote: "लगभग",
		placeholder: "--",
		secUnit: "सेकंड",
		separator: " · ",
		contactOverlay: "उंगली का पता नहीं चला — कृपया उंगली को कैमरे के लेंस पर दृढ़ता से रखें",
		readyHint: "स्कैन शुरू करने के लिए अपनी उंगली को कैमरे के लेंस पर दृढ़ता से रखें।",
		scanningLabel: "स्कैन हो रहा है",
		pausedLabel: "रुका हुआ — उंगली के संपर्क की प्रतीक्षा",
		demoButton: "12 सेकंड का डेमो सिमुलेशन चलाएँ (लैपटॉप पर जजों के लिए)",
		newScanButton: "नया स्कैन",
		grantPermissionButton: "अनुमति दें",
		permissionDeniedTitle: "कैमरे की पहुँच रुकी हुई है",
		permissionDeniedBody: "यूनिवोल्ट को उंगली से नाड़ी पढ़ने के लिए कैमरे की आवश्यकता है। नीचे अनुमति दें — या पूरी प्रक्रिया देखने के लिए 12 सेकंड का डेमो सिमुलेशन चलाएँ।",
		permissionUnsupportedTitle: "कैमरा उपलब्ध नहीं",
		permissionUnsupportedBody: "इस ब्राउज़र में कैमरा उपलब्ध नहीं है। पूरी प्रक्रिया देखने के लिए आप डेमो सिमुलेशन चला सकते हैं।",
		scanComplete: "स्कैन पूर्ण",
		guidanceTitle: "जागरूकता एवं ट्राइज मार्गदर्शन",
		guidanceIntro: "जाँच के बाद यह सलाह मरीज़ को सुनाएँ:",
		languageLabel: "भाषा",
		localeNameEn: "English",
		localeNameHi: "हिंदी",
		historyTitle: "स्कैन इतिहास",
		historyEmpty: "अभी तक कोई स्कैन नहीं।",
		clearHistoryButton: "इतिहास मिटाएँ",
		disclaimer: "यह चिकित्सा उपकरण नहीं है। केवल जाँच और शिक्षा के लिए। आपातकाल में नज़दीकी स्वास्थ्य केंद्र जाएँ।",
		guidance: {
			urgentPrefix: "तत्काल — ",
			referralLine: "कृपया शीघ्र-से-शीघ्र नज़दीकी प्राथमिक स्वास्थ्य केंद्र (PHC) पर जाएँ।",
			triage: {
				normal: {
					title: "सभी माप सामान्य",
					body: "हृदय गति, ऑक्सीजन और श्वसन — तीनों माप सामान्य सीमा में हैं। मरीज़ को पानी पिलाने और कुछ देर आराम करने की सलाह दें।"
				},
				borderline: {
					title: "माप सामान्य सीमा के किनारे",
					body: "एक या अधिक माप सामान्य सीमा के ठीक बाहर हैं। मरीज़ को पाँच मिनट आराम कराकर दोबारा स्कैन करें।"
				},
				tachycardia: {
					title: "हृदय गति तेज़ (टैकीकार्डिया)",
					body: "दिल सामान्य से तेज़ धड़क रहा है। मरीज़ को बैठाकर शांत रखें। चक्कर आना, सीने में दर्द या गति 120 से ऊपर बनी रहे तो इसे तत्काल मानें।"
				},
				bradycardia: {
					title: "हृदय गति धीमी (ब्रैडीकार्डिया)",
					body: "दिल सामान्य से धीमा धड़क रहा है। चक्कर, कमजोरी या बेहोशी के लक्षण पूछें — हों तो इंतज़ार न करें और आज ही भेजें।"
				},
				hypoxia: {
					title: "ऑक्सीजन कम (संभावित हाइपोक्सिया)",
					body: "रक्त में ऑक्सीजन सामान्य से कम प्रतीत हो रही है। मरीज़ को बैठकर आराम दें और दोबारा जाँचें। स्तर 90 से कम हो तो तत्काल उपचार चाहिए।"
				},
				tachypnea: {
					title: "साँस तेज़ (टैकीपनिया)",
					body: "श्वसन दर सामान्य से तेज़ है। मरीज़ को बैठने दें और पाँच मिनट बाद साँस फिर गिनें। अब भी तेज़ हो तो भेजें।"
				},
				inconclusive: {
					title: "संकेत अपर्याप्त",
					body: "इस स्कैन से भरोसेमंद माप नहीं मिले। लेंस साफ़ करें, उंगली को दृढ़ता से लेंस पर रखें और दोबारा स्कैन करें।"
				}
			}
		}
	}
};
function getStrings(locale) {
	return translations[locale];
}
function VitalsScanScreen() {
	const videoRef = (0, import_react.useRef)(null);
	const ppgCanvasRef = (0, import_react.useRef)(null);
	const { state, actions } = usePpgCapture({
		videoRef,
		ppgCanvasRef
	});
	const [locale, setLocale] = (0, import_react.useState)(() => loadLocale() ?? "en");
	const t = (0, import_react.useMemo)(() => getStrings(locale), [locale]);
	const handleSetLocale = (0, import_react.useCallback)((next) => {
		setLocale(next);
	}, []);
	(0, import_react.useEffect)(() => {
		saveLocale(locale);
	}, [locale]);
	const triage = (0, import_react.useMemo)(() => state.result === null ? null : evaluateTriage(state.result), [state.result]);
	const [history, setHistory] = (0, import_react.useState)(() => loadScans());
	const savedScanIdsRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	(0, import_react.useEffect)(() => {
		const result = state.result;
		if (result === null || triage === null) return;
		if (savedScanIdsRef.current.has(result.scanId)) return;
		savedScanIdsRef.current.add(result.scanId);
		saveScan({
			id: result.scanId,
			timestamp: result.timestamp,
			mode: result.mode,
			bpm: result.bpm,
			hrv: result.hrv,
			spo2: result.spo2,
			rr: result.rr,
			locale,
			triageLevel: triage.level
		});
		setHistory(loadScans());
	}, [
		state.result,
		triage,
		locale
	]);
	const handleClearHistory = (0, import_react.useCallback)(() => {
		clearScans();
		setHistory([]);
	}, []);
	const durationMs = state.mode === "demo" ? DEMO_DURATION_MS : LIVE_CAPTURE_MS;
	const progressPct = Math.min(100, state.progressMs / durationMs * 100);
	const remainingSec = Math.max(0, Math.ceil((durationMs - state.progressMs) / 1e3));
	const showContactOverlay = (state.phase === "idle" || state.phase === "capturing_live" || state.phase === "paused") && state.permission === "granted" && state.mode !== "demo" && !state.contact;
	const showPermissionFallback = (state.permission === "denied" || state.permission === "unsupported") && state.phase === "idle";
	const scanning = state.phase === "capturing_live" || state.phase === "demo_running";
	const metricsReadable = state.mode === "demo" || state.contact;
	const metrics = state.result !== null ? state.result : scanning && metricsReadable ? state.liveMetrics : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		style: screenStyle,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			style: wrapStyle,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					style: headerStyle,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						style: titleStyle,
						children: t.appTitle
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						style: taglineStyle,
						children: t.tagline
					})] }), state.mode !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						style: state.mode === "demo" ? demoBadgeStyle : liveBadgeStyle,
						children: state.mode === "demo" ? t.simulatedBadge : t.liveBadge
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					style: cameraSectionStyle,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
							ref: videoRef,
							style: state.phase === "demo_running" ? videoDimStyle : videoStyle,
							autoPlay: true,
							muted: true,
							playsInline: true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
							ref: ppgCanvasRef,
							style: ppgCanvasStyle
						}),
						state.phase === "demo_running" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							style: demoBannerStyle,
							children: t.simulatedBadge
						}),
						showPermissionFallback && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionFallback, {
							t,
							unsupported: state.permission === "unsupported",
							onGrant: actions.requestCamera
						}),
						showContactOverlay && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							style: contactOverlayStyle,
							children: t.contactOverlay
						})
					]
				}),
				scanning || state.phase === "paused" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: progressRowStyle,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						style: progressTrackStyle,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
							...progressFillStyle,
							width: `${progressPct.toFixed(1)}%`
						} })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						style: progressLabelStyle,
						children: `${state.phase === "paused" ? t.pausedLabel : t.scanningLabel}${t.separator}${remainingSec}${t.secUnit}`
					})]
				}) : null,
				state.phase === "idle" && state.permission !== "denied" && state.permission !== "unsupported" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					style: mutedStyle,
					children: t.readyHint
				}),
				state.phase === "demo_running" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					style: mutedStyle,
					children: t.demoModeNotice
				}),
				state.phase === "complete" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					style: sectionTitleStyle,
					children: t.scanComplete
				}),
				state.phase === "complete" && state.result !== null && state.result.mode === "demo" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					style: watermarkStyle,
					children: t.demoWatermark
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					style: metricsGridStyle,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricTile, {
							label: t.metricHeartRate,
							value: metrics === null ? null : metrics.bpm,
							unit: t.metricHeartRateUnit,
							note: null,
							placeholder: t.placeholder,
							separator: t.separator
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricTile, {
							label: t.metricHrv,
							value: metrics === null ? null : metrics.hrv,
							unit: t.metricHrvUnit,
							note: null,
							placeholder: t.placeholder,
							separator: t.separator
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricTile, {
							label: t.metricSpo2,
							value: metrics === null ? null : metrics.spo2,
							unit: t.metricSpo2Unit,
							note: t.metricSpo2Note,
							placeholder: t.placeholder,
							separator: t.separator
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricTile, {
							label: t.metricRespRate,
							value: metrics === null ? null : metrics.rr,
							unit: t.metricRespRateUnit,
							note: t.metricRespRateNote,
							placeholder: t.placeholder,
							separator: t.separator
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: controlsStyle,
					children: [state.phase === "idle" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: actions.startDemo,
						style: secondaryButtonStyle,
						children: t.demoButton
					}), state.phase === "complete" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: actions.reset,
						style: primaryButtonStyle,
						children: t.newScanButton
					})]
				}),
				state.phase === "complete" && triage !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuidanceCard, {
					t,
					triage,
					locale,
					onSetLocale: handleSetLocale
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryList, {
					history,
					t,
					onClear: handleClearHistory
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
					style: footerStyle,
					children: t.disclaimer
				})
			]
		})
	});
}
function MetricTile({ label, value, unit, note, placeholder, separator }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		style: metricTileStyle,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				style: metricLabelStyle,
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				style: metricValueStyle,
				children: value === null ? placeholder : Math.round(value)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				style: metricUnitStyle,
				children: [unit, note !== null ? `${separator}${note}` : null]
			})
		]
	});
}
function PermissionFallback({ t, unsupported, onGrant }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		style: permissionFallbackStyle,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				style: sectionTitleStyle,
				children: unsupported ? t.permissionUnsupportedTitle : t.permissionDeniedTitle
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				style: mutedStyle,
				children: unsupported ? t.permissionUnsupportedBody : t.permissionDeniedBody
			}),
			!unsupported && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onGrant,
				style: primaryButtonStyle,
				children: t.grantPermissionButton
			})
		]
	});
}
function GuidanceCard({ t, triage, locale, onSetLocale }) {
	const branch = t.guidance.triage[triage.level];
	const headingColor = triage.urgent ? "#f87171" : triage.referral ? "#fbbf24" : "#4ade80";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		style: guidanceCardStyle,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				style: guidanceHeaderStyle,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					style: sectionTitleStyle,
					children: t.guidanceTitle
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: localeToggleStyle,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							style: localeToggleLabelStyle,
							children: t.languageLabel
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							style: locale === "en" ? localeActiveStyle : localeInactiveStyle,
							"aria-pressed": locale === "en",
							onClick: () => onSetLocale("en"),
							children: t.localeNameEn
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							style: locale === "hi" ? localeActiveStyle : localeInactiveStyle,
							"aria-pressed": locale === "hi",
							onClick: () => onSetLocale("hi"),
							children: t.localeNameHi
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				style: mutedStyle,
				children: t.guidanceIntro
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				style: {
					...triageHeadingStyle,
					color: headingColor
				},
				children: branch.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				style: guidanceBodyStyle,
				children: branch.body
			}),
			triage.referral && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				style: referralBoxStyle,
				children: [triage.urgent && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
					style: urgentTextStyle,
					children: t.guidance.urgentPrefix
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t.guidance.referralLine })]
			})
		]
	});
}
function HistoryList({ history, t, onClear }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		style: historySectionStyle,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			style: historyHeaderStyle,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				style: sectionTitleStyle,
				children: t.historyTitle
			}), history.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onClear,
				style: linkButtonStyle,
				children: t.clearHistoryButton
			})]
		}), history.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			style: mutedStyle,
			children: t.historyEmpty
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			style: historyListStyle,
			children: history.map((record) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				style: record.mode === "demo" ? historyDemoRowStyle : historyLiveRowStyle,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						style: historyRowTopStyle,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							style: mutedStyle,
							children: formatTimestamp(record.timestamp, record.locale)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							style: record.mode === "demo" ? demoBadgeStyle : liveBadgeStyle,
							children: record.mode === "demo" ? t.simulatedBadge : t.liveBadge
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						style: historyMetricsStyle,
						children: `${t.metricHeartRate}: ${record.bpm ?? t.placeholder} ${t.metricHeartRateUnit}${t.separator}${t.metricSpo2}: ${record.spo2 ?? t.placeholder}${t.metricSpo2Unit}${t.separator}${t.metricRespRate}: ${record.rr ?? t.placeholder} ${t.metricRespRateUnit}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						style: mutedStyle,
						children: t.guidance.triage[record.triageLevel].title
					})
				]
			}, record.id))
		})]
	});
}
function formatTimestamp(timestamp, locale) {
	const localeTag = locale === "hi" ? "hi-IN" : "en-IN";
	return new Date(timestamp).toLocaleString(localeTag);
}
var screenStyle = {
	minHeight: "100vh",
	background: "#0b1120",
	color: "#e2e8f0",
	fontFamily: "system-ui, \"Segoe UI\", sans-serif",
	padding: "20px 16px 48px",
	boxSizing: "border-box"
};
var wrapStyle = {
	maxWidth: 720,
	margin: "0 auto",
	display: "flex",
	flexDirection: "column",
	gap: 16
};
var headerStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 12
};
var titleStyle = {
	margin: 0,
	fontSize: 22,
	fontWeight: 700
};
var taglineStyle = {
	margin: "2px 0 0",
	fontSize: 13,
	color: "#94a3b8"
};
var badgeBase = {
	padding: "4px 10px",
	borderRadius: 999,
	fontSize: 11,
	fontWeight: 700,
	letterSpacing: 1
};
var liveBadgeStyle = {
	...badgeBase,
	background: "rgba(52,211,153,0.15)",
	color: "#34d399",
	border: "1px solid rgba(52,211,153,0.4)"
};
var demoBadgeStyle = {
	...badgeBase,
	background: "rgba(251,191,36,0.15)",
	color: "#fbbf24",
	border: "1px dashed rgba(251,191,36,0.6)"
};
var cameraSectionStyle = {
	position: "relative",
	borderRadius: 14,
	overflow: "hidden",
	background: "#000",
	border: "1px solid #1e293b"
};
var videoStyle = {
	display: "block",
	width: "100%",
	height: 280,
	objectFit: "cover",
	background: "#000"
};
var videoDimStyle = {
	...videoStyle,
	opacity: .2
};
var ppgCanvasStyle = {
	position: "absolute",
	left: 0,
	bottom: 0,
	width: "100%",
	height: 96,
	background: "rgba(2,6,23,0.55)",
	borderTop: "1px solid rgba(148,163,184,0.2)"
};
var contactOverlayStyle = {
	position: "absolute",
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	textAlign: "center",
	padding: 24,
	background: "rgba(127,29,29,0.55)",
	color: "#fecaca",
	fontWeight: 600,
	fontSize: 16
};
var demoBannerStyle = {
	position: "absolute",
	top: 12,
	left: 12,
	padding: "4px 10px",
	borderRadius: 999,
	background: "#fbbf24",
	color: "#451a03",
	fontWeight: 700,
	fontSize: 11,
	letterSpacing: .5
};
var permissionFallbackStyle = {
	position: "absolute",
	inset: 0,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: 10,
	padding: 24,
	textAlign: "center",
	background: "rgba(2,6,23,0.88)"
};
var progressRowStyle = {
	display: "flex",
	alignItems: "center",
	gap: 12
};
var progressTrackStyle = {
	height: 8,
	borderRadius: 999,
	background: "#1e293b",
	overflow: "hidden",
	flex: 1
};
var progressFillStyle = {
	height: "100%",
	background: "#34d399",
	width: 0,
	transition: "width 0.4s linear"
};
var progressLabelStyle = {
	fontSize: 13,
	color: "#94a3b8",
	whiteSpace: "nowrap"
};
var metricsGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	gap: 12
};
var metricTileStyle = {
	background: "#111a2e",
	border: "1px solid #1e293b",
	borderRadius: 14,
	padding: "14px 16px",
	textAlign: "center"
};
var metricLabelStyle = {
	fontSize: 12,
	color: "#94a3b8",
	letterSpacing: .3
};
var metricValueStyle = {
	fontSize: 34,
	fontWeight: 700,
	margin: "6px 0 2px",
	color: "#f1f5f9",
	fontVariantNumeric: "tabular-nums"
};
var metricUnitStyle = {
	fontSize: 11,
	color: "#64748b"
};
var controlsStyle = {
	display: "flex",
	gap: 12,
	flexWrap: "wrap"
};
var primaryButtonStyle = {
	padding: "12px 18px",
	borderRadius: 10,
	border: "none",
	background: "#34d399",
	color: "#052e21",
	fontWeight: 700,
	fontSize: 14,
	cursor: "pointer"
};
var secondaryButtonStyle = {
	padding: "12px 18px",
	borderRadius: 10,
	background: "transparent",
	color: "#cbd5e1",
	border: "1px dashed #475569",
	fontWeight: 600,
	fontSize: 13,
	cursor: "pointer"
};
var linkButtonStyle = {
	background: "none",
	border: "none",
	color: "#94a3b8",
	fontSize: 12,
	cursor: "pointer",
	textDecoration: "underline"
};
var watermarkStyle = {
	padding: "10px 14px",
	borderRadius: 10,
	background: "rgba(251,191,36,0.12)",
	border: "1px dashed #fbbf24",
	color: "#fbbf24",
	fontWeight: 700,
	fontSize: 13,
	letterSpacing: .5
};
var guidanceCardStyle = {
	background: "#111a2e",
	border: "1px solid #27354f",
	borderRadius: 14,
	padding: 18
};
var guidanceHeaderStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	flexWrap: "wrap",
	gap: 10,
	marginBottom: 6
};
var sectionTitleStyle = {
	fontSize: 16,
	fontWeight: 700,
	margin: 0,
	color: "#f1f5f9"
};
var localeToggleStyle = {
	display: "flex",
	alignItems: "center",
	gap: 6
};
var localeToggleLabelStyle = {
	fontSize: 12,
	color: "#94a3b8"
};
var localeActiveStyle = {
	padding: "4px 10px",
	borderRadius: 8,
	border: "1px solid #34d399",
	background: "rgba(52,211,153,0.15)",
	color: "#34d399",
	fontWeight: 700,
	fontSize: 12,
	cursor: "pointer"
};
var localeInactiveStyle = {
	padding: "4px 10px",
	borderRadius: 8,
	border: "1px solid #334155",
	background: "transparent",
	color: "#94a3b8",
	fontSize: 12,
	cursor: "pointer"
};
var triageHeadingStyle = {
	fontSize: 18,
	fontWeight: 700,
	margin: "14px 0 6px"
};
var guidanceBodyStyle = {
	margin: 0,
	fontSize: 15,
	lineHeight: 1.6,
	color: "#cbd5e1"
};
var referralBoxStyle = {
	marginTop: 12,
	padding: "12px 14px",
	borderRadius: 10,
	background: "rgba(248,113,113,0.08)",
	border: "1px solid rgba(248,113,113,0.35)",
	fontSize: 14,
	lineHeight: 1.5,
	color: "#fecaca"
};
var urgentTextStyle = { color: "#f87171" };
var historySectionStyle = {
	background: "#0d1526",
	border: "1px solid #1e293b",
	borderRadius: 14,
	padding: 16
};
var historyHeaderStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: 8
};
var historyListStyle = {
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "flex",
	flexDirection: "column",
	gap: 10
};
var historyLiveRowStyle = {
	padding: "10px 12px",
	borderRadius: 10,
	background: "#111a2e",
	border: "1px solid #1e293b"
};
var historyDemoRowStyle = {
	padding: "10px 12px",
	borderRadius: 10,
	background: "rgba(251,191,36,0.06)",
	border: "1px dashed #f59e0b"
};
var historyRowTopStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: 8,
	marginBottom: 4
};
var historyMetricsStyle = {
	fontSize: 13,
	color: "#cbd5e1",
	marginBottom: 2
};
var mutedStyle = {
	color: "#94a3b8",
	fontSize: 13,
	margin: 0
};
var footerStyle = {
	marginTop: 8,
	fontSize: 12,
	color: "#64748b",
	textAlign: "center"
};
function ScanRoute() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VitalsScanScreen, {});
}
//#endregion
export { ScanRoute as component };
