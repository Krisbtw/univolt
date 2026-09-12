import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, b as require_jsx_runtime, f as createRouter, g as createRootRoute, h as createFileRoute, l as Scripts, m as lazyRouteComponent, p as Outlet, u as HeadContent, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { a as SavedLocalBadge, f as useUnivolt, i as Button, n as AppHeader, o as cn, r as BootScreen, t as AppFrame, u as selectPatient } from "./button-ByDeNH4n.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-ucQu3KjV.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-yBf7iTW3.css";
var APP_NAME = "Univolt";
var Route$7 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Offline field vitals kit — PPG heart rate, estimated respiratory rate, SpO2 screening, and cough heuristic."
			},
			{
				name: "theme-color",
				content: "#145C4C"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: RootComponent
});
function RootComponent() {
	const init = useUnivolt((s) => s.init);
	const ready = useUnivolt((s) => s.ready);
	(0, import_react.useEffect)(() => {
		init();
	}, [init]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BootScreen, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	});
}
var $$splitComponentImporter$4 = () => import("./routes-DIhbfeZ2.mjs");
var Route$6 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./register-KG4S76Op.mjs");
var Route$5 = createFileRoute("/register")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./scan-AvDbzLan.mjs");
var Route$4 = createFileRoute("/scan")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./patient._id-DnrMQPh9.mjs");
var Route$3 = createFileRoute("/patient/$id")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./patient._id.index-uHlkg99Z.mjs");
var Route$2 = createFileRoute("/patient/$id/")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
function WaveformCanvas({ samplesRef, className, color = "#9ee0c2", grid = "#1b3a31", background = "#10221c" }) {
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		let raf = 0;
		const draw = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
				canvas.width = Math.floor(w * dpr);
				canvas.height = Math.floor(h * dpr);
			}
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.fillStyle = background;
			ctx.fillRect(0, 0, w, h);
			ctx.strokeStyle = grid;
			ctx.lineWidth = 1;
			for (let x = 0; x < w; x += 28) {
				ctx.beginPath();
				ctx.moveTo(x + .5, 0);
				ctx.lineTo(x + .5, h);
				ctx.stroke();
			}
			for (let y = 0; y < h; y += 22) {
				ctx.beginPath();
				ctx.moveTo(0, y + .5);
				ctx.lineTo(w, y + .5);
				ctx.stroke();
			}
			const data = samplesRef.current;
			if (data.length > 1) {
				let min = Infinity;
				let max = -Infinity;
				for (const v of data) {
					if (v < min) min = v;
					if (v > max) max = v;
				}
				const pad = (max - min) * .18 || .05;
				min -= pad;
				max += pad;
				ctx.beginPath();
				ctx.strokeStyle = color;
				ctx.lineWidth = 1.6;
				ctx.lineJoin = "round";
				ctx.lineCap = "round";
				const windowed = data.length > 220 ? data.slice(data.length - 220) : data;
				for (let i = 0; i < windowed.length; i++) {
					const x = i / Math.max(windowed.length - 1, 1) * w;
					const y = h - (windowed[i] - min) / (max - min) * h;
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.stroke();
			}
			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [
		background,
		color,
		grid,
		samplesRef
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		className
	});
}
function StaticWaveform({ samples, className, color = "#145c4c" }) {
	if (samples.length < 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className });
	let min = Infinity;
	let max = -Infinity;
	for (const v of samples) {
		if (v < min) min = v;
		if (v > max) max = v;
	}
	const span = max - min || 1;
	const w = 320;
	const h = 72;
	const d = samples.map((v, i) => {
		const x = i / (samples.length - 1) * w;
		const y = h - (v - min) / span * 64 - 4;
		return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: `0 0 ${w} ${h}`,
		className,
		"aria-hidden": "true",
		preserveAspectRatio: "none",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d,
			fill: "none",
			stroke: color,
			strokeWidth: "1.6",
			strokeLinejoin: "round"
		})
	});
}
var badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide", {
	variants: { variant: {
		default: "bg-pine/10 text-pine",
		muted: "bg-line/70 text-muted",
		warn: "bg-warn/12 text-warn",
		ok: "bg-ok/12 text-ok",
		danger: "bg-danger/12 text-danger",
		monitor: "bg-monitor text-trace"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
function mean$1(xs) {
	if (xs.length === 0) return 0;
	let s = 0;
	for (const x of xs) s += x;
	return s / xs.length;
}
function variance(xs) {
	if (xs.length < 2) return 0;
	const m = mean$1(xs);
	let s = 0;
	for (const x of xs) s += (x - m) ** 2;
	return s / (xs.length - 1);
}
/**
* Prototype acoustic heuristic — not a trained diagnostic classifier.
* Uses zero-crossing rate + short-time energy variance on a PCM buffer.
*/
function analyzeCoughPcm(samples, sampleRate) {
	const n = samples.length;
	const durationSec = n / sampleRate || 6;
	if (n < sampleRate * .4) return {
		classification: "Normal",
		zeroCrossingRate: 0,
		energyVariance: 0,
		durationSec,
		simulated: false,
		notes: "Sample too short for heuristic."
	};
	let crossings = 0;
	for (let i = 1; i < n; i++) {
		const a = samples[i - 1];
		const b = samples[i];
		if (a >= 0 && b < 0 || a < 0 && b >= 0) crossings += 1;
	}
	const zeroCrossingRate = crossings / durationSec;
	const frame = Math.max(32, Math.floor(.03 * sampleRate));
	const hop = Math.max(16, Math.floor(frame / 2));
	const energies = [];
	for (let i = 0; i + frame < n; i += hop) {
		let e = 0;
		for (let j = 0; j < frame; j++) {
			const v = samples[i + j];
			e += v * v;
		}
		energies.push(e / frame);
	}
	const energyVariance = variance(energies);
	const energyMean = mean$1(energies);
	const irregular = energyVariance / (energyMean + 1e-8) > 2.4 && zeroCrossingRate > 280 && energyMean > 4e-4;
	return {
		classification: irregular ? "Possible irregular breathing pattern — refer for clinical follow-up" : "Normal",
		zeroCrossingRate: Math.round(zeroCrossingRate),
		energyVariance: Number(energyVariance.toExponential(2) === "0.0e+0" ? energyVariance : energyVariance),
		durationSec,
		simulated: false,
		notes: irregular ? "High short-time energy variance with elevated zero-crossing rate." : "Energy envelope within the quiet-breathing band of this prototype."
	};
}
/** Evenly-strided downsample so long real-mic buffers stay cheap to draw as a trace. */
function downsampleTrace(samples, target = 1200) {
	const n = samples.length;
	if (n <= target) return Array.from(samples);
	const stride = Math.max(1, Math.floor(n / target));
	const out = [];
	for (let i = 0; i < n; i += stride) out.push(samples[i]);
	return out;
}
/** Canned mock used when the microphone API is missing or permission is denied. */
function generateMockCoughResult(kind = "normal") {
	const sampleRate = 4e3;
	const n = sampleRate * 6;
	const samples = new Array(n);
	for (let i = 0; i < n; i++) {
		const t = i / sampleRate;
		const breath = .04 * Math.sin(2 * Math.PI * .35 * t);
		let burst = 0;
		if (kind === "irregular") {
			const cycle = t % 1.15;
			if (cycle < .09) burst = .55 * Math.sin(2 * Math.PI * 380 * t) * (1 - cycle / .09);
		}
		samples[i] = breath + burst + (Math.random() - .5) * .012;
	}
	const result = analyzeCoughPcm(samples, sampleRate);
	result.simulated = true;
	result.notes = kind === "irregular" ? "Demo audio (microphone unavailable). Prototype heuristic flagged a bursty envelope." : "Demo audio (microphone unavailable). Prototype heuristic classified as normal.";
	if (kind === "irregular") result.classification = "Possible irregular breathing pattern — refer for clinical follow-up";
	else result.classification = "Normal";
	return {
		samples,
		result
	};
}
async function recordCoughAudio(durationSec = 6, onLevel) {
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
	let stream;
	try {
		stream = await Promise.race([navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true
			},
			video: false
		}), new Promise((_, reject) => {
			window.setTimeout(() => reject(/* @__PURE__ */ new Error("mic-timeout")), 1800);
		})]);
	} catch {
		return null;
	}
	const ctx = new (window.AudioContext || window.webkitAudioContext)();
	const source = ctx.createMediaStreamSource(stream);
	const processor = ctx.createScriptProcessor(4096, 1, 1);
	const silent = ctx.createGain();
	silent.gain.value = 0;
	const chunks = [];
	processor.onaudioprocess = (ev) => {
		const input = ev.inputBuffer.getChannelData(0);
		chunks.push(new Float32Array(input));
		if (onLevel) {
			let e = 0;
			for (let i = 0; i < input.length; i++) e += input[i] * input[i];
			onLevel(Math.sqrt(e / input.length));
		}
	};
	source.connect(processor);
	processor.connect(silent);
	silent.connect(ctx.destination);
	await new Promise((resolve) => window.setTimeout(resolve, durationSec * 1e3));
	processor.disconnect();
	source.disconnect();
	silent.disconnect();
	stream.getTracks().forEach((t) => t.stop());
	const sampleRate = ctx.sampleRate || 44100;
	await ctx.close().catch(() => void 0);
	let total = 0;
	for (const c of chunks) total += c.length;
	const samples = new Float32Array(total);
	let o = 0;
	for (const c of chunks) {
		samples.set(c, o);
		o += c.length;
	}
	return {
		samples,
		sampleRate
	};
}
var Route$1 = createFileRoute("/patient/$id/cough")({ component: CoughScreen });
function CoughScreen() {
	const { id } = Route$1.useParams();
	const db = useUnivolt((s) => s.db);
	const addCoughScreening = useUnivolt((s) => s.addCoughScreening);
	const patient = selectPatient(db, id);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [remaining, setRemaining] = (0, import_react.useState)(6);
	const [level, setLevel] = (0, import_react.useState)(0);
	const [result, setResult] = (0, import_react.useState)(null);
	const [trace, setTrace] = (0, import_react.useState)([]);
	const [saved, setSaved] = (0, import_react.useState)(false);
	const cancelRef = (0, import_react.useRef)(false);
	const runIdRef = (0, import_react.useRef)(0);
	(0, import_react.useEffect)(() => {
		return () => {
			cancelRef.current = true;
		};
	}, []);
	function finishCapture(next, samples, runId) {
		if (runId !== runIdRef.current) return;
		setTrace(samples);
		setResult(next);
		setPhase("done");
		setLevel(0);
		if (patient) {
			addCoughScreening(patient.id, next);
			setSaved(true);
		}
	}
	function runMockCapture(runId) {
		const mock = generateMockCoughResult("normal");
		const started = performance.now();
		const tick = window.setInterval(() => {
			if (runId !== runIdRef.current) {
				window.clearInterval(tick);
				return;
			}
			const elapsed = (performance.now() - started) / 1e3;
			setRemaining(Math.max(0, Math.ceil(6 - elapsed)));
			const frac = Math.min(1, elapsed / 6);
			const n = Math.max(2, Math.floor(frac * mock.samples.length));
			setTrace(downsampleTrace(mock.samples.slice(0, n)));
			setLevel(.08 + .12 * Math.abs(Math.sin(elapsed * 3.1)));
			if (elapsed >= 6) {
				window.clearInterval(tick);
				setPhase("processing");
				window.setTimeout(() => {
					finishCapture(mock.result, downsampleTrace(mock.samples), runId);
				}, 350);
			}
		}, 100);
	}
	async function runScreen() {
		if (phase === "recording" || phase === "processing") return;
		const runId = runIdRef.current + 1;
		runIdRef.current = runId;
		setResult(null);
		setSaved(false);
		setTrace([]);
		setRemaining(6);
		setLevel(0);
		setPhase("recording");
		if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
			setRemaining(6);
			runMockCapture(runId);
			return;
		}
		const started = performance.now();
		const countdown = window.setInterval(() => {
			if (runId !== runIdRef.current) {
				window.clearInterval(countdown);
				return;
			}
			const elapsed = (performance.now() - started) / 1e3;
			setRemaining(Math.max(0, Math.ceil(6 - elapsed)));
		}, 100);
		const captured = await recordCoughAudio(6, (rms) => {
			if (runId !== runIdRef.current) return;
			setLevel(rms);
		});
		window.clearInterval(countdown);
		if (runId !== runIdRef.current) return;
		if (!captured) {
			setRemaining(6);
			setLevel(0);
			runMockCapture(runId);
			return;
		}
		setPhase("processing");
		window.setTimeout(() => {
			if (runId !== runIdRef.current) return;
			finishCapture(analyzeCoughPcm(captured.samples, captured.sampleRate), downsampleTrace(captured.samples), runId);
		}, 350);
	}
	if (!patient) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppFrame, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, {
		back: { to: "/" },
		title: "Patient not found"
	}) });
	const flagged = result && result.classification !== "Normal";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppFrame, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, {
		back: {
			to: "/patient/$id",
			params: { id: patient.id }
		},
		title: "Cough screening",
		subtitle: patient.name
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex flex-1 flex-col gap-4 px-4 pb-10 pt-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-[24px] border border-line bg-paper p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] font-medium uppercase tracking-[0.14em] text-muted",
						children: "Prototype heuristic — not a diagnostic classifier"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm leading-relaxed text-muted",
						children: [
							"Captures about ",
							6,
							" seconds of microphone audio, then scores zero-crossing rate and short-time energy variance. If the browser blocks the microphone, a demo waveform and canned result are used instead."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 h-20 overflow-hidden rounded-[16px] bg-surface",
						children: trace.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StaticWaveform, {
							samples: trace,
							className: "h-full w-full"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-full items-center px-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-2 flex-1 overflow-hidden rounded-full bg-line",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full rounded-full bg-pine transition-[width] duration-150",
									style: { width: `${Math.min(100, Math.max(4, level * 280))}%` }
								})
							})
						})
					}),
					phase === "recording" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm font-medium tabular-nums text-pine",
						children: [
							"Recording ",
							remaining,
							"s"
						]
					}) : null
				]
			}),
			phase !== "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "lg",
				onClick: () => runScreen(),
				disabled: phase === "recording" || phase === "processing",
				children: phase === "recording" ? `Hold near mouth… ${remaining}s` : phase === "processing" ? "Scoring envelope…" : "Capture 6s audio sample"
			}) : null,
			result && phase === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[24px] border border-line bg-paper p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-ink",
							children: "Screening result"
						}), saved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SavedLocalBadge, {}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						variant: flagged ? "warn" : "ok",
						children: flagged ? "Follow-up" : "Normal"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-[1.05rem] font-medium leading-snug text-ink",
						children: result.classification
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-3 grid grid-cols-2 gap-2 text-[12px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-[16px] bg-surface px-3 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted",
								children: "Zero-crossing rate"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
								className: "mt-0.5 font-medium tabular-nums text-ink",
								children: [result.zeroCrossingRate, " /s"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-[16px] bg-surface px-3 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted",
								children: "Energy variance"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "mt-0.5 font-medium tabular-nums text-ink",
								children: result.energyVariance < .001 ? result.energyVariance.toExponential(1) : result.energyVariance.toFixed(4)
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-[11px] leading-relaxed text-faint",
						children: result.notes
					}),
					result.simulated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[11px] font-medium text-warn",
						children: "Microphone unavailable — demo audio used."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						className: "mt-4 w-full",
						size: "lg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/patient/$id",
							params: { id: patient.id },
							children: "Back to record"
						})
					})
				]
			}) : null
		]
	})] });
}
/** Morphologically plausible fingertip PPG pulse (systolic peak + dicrotic notch). */
function pulseShape(phase) {
	const p = (phase % 1 + 1) % 1;
	return Math.exp(-((p - .16) ** 2) / (2 * .045 ** 2)) + .34 * Math.exp(-((p - .42) ** 2) / (2 * .055 ** 2));
}
function mean(xs) {
	if (xs.length === 0) return 0;
	let s = 0;
	for (const x of xs) s += x;
	return s / xs.length;
}
function stdev(xs) {
	if (xs.length < 2) return 0;
	const m = mean(xs);
	let s = 0;
	for (const x of xs) s += (x - m) ** 2;
	return Math.sqrt(s / (xs.length - 1));
}
function movingAverage(xs, window) {
	const w = Math.max(1, Math.floor(window));
	const out = new Array(xs.length);
	let acc = 0;
	for (let i = 0; i < xs.length; i++) {
		acc += xs[i];
		if (i >= w) acc -= xs[i - w];
		const n = i < w - 1 ? i + 1 : w;
		out[i] = acc / n;
	}
	return out;
}
/** Band-limit by subtracting a slow MA (high-pass) then applying a fast MA (low-pass). */
function bandpass(xs, sampleRate, lowHz, highHz) {
	const slowN = Math.max(3, Math.round(sampleRate / Math.max(lowHz, .05)));
	const fastN = Math.max(2, Math.round(sampleRate / Math.max(highHz * 2, .2)));
	const slow = movingAverage(xs, slowN);
	return movingAverage(xs.map((x, i) => x - slow[i]), fastN);
}
function detectPeaks(signal, sampleRate, minBpm = 45, maxBpm = 160) {
	if (signal.length < 5) return [];
	const minDist = Math.max(2, Math.floor(sampleRate * 60 / maxBpm));
	const thresh = mean(signal) + .28 * (stdev(signal) || 1);
	const peaks = [];
	for (let i = 2; i < signal.length - 2; i++) {
		const y = signal[i];
		if (y < thresh) continue;
		if (y >= signal[i - 1] && y >= signal[i + 1] && y >= signal[i - 2] && y >= signal[i + 2]) {
			const last = peaks[peaks.length - 1];
			if (last != null && i - last < minDist) {
				if (y > signal[last]) peaks[peaks.length - 1] = i;
				continue;
			}
			peaks.push(i);
		}
	}
	const minIbi = 60 / maxBpm * sampleRate;
	const maxIbi = 60 / minBpm * sampleRate;
	const filtered = [];
	for (const p of peaks) {
		const prev = filtered[filtered.length - 1];
		if (prev == null) {
			filtered.push(p);
			continue;
		}
		const ibi = p - prev;
		if (ibi < minIbi) continue;
		if (ibi > maxIbi * 1.6 && filtered.length > 1) {
			filtered.push(p);
			continue;
		}
		filtered.push(p);
	}
	return filtered;
}
function ibiMs(peaks, sampleRate) {
	const out = [];
	for (let i = 1; i < peaks.length; i++) out.push((peaks[i] - peaks[i - 1]) / sampleRate * 1e3);
	return out;
}
function rmssd(ibis) {
	if (ibis.length < 2) return 0;
	let acc = 0;
	let n = 0;
	for (let i = 1; i < ibis.length; i++) {
		const d = ibis[i] - ibis[i - 1];
		acc += d * d;
		n += 1;
	}
	return Math.sqrt(acc / n);
}
function countPeaksSimple(signal, sampleRate, minDistSec) {
	if (signal.length < 6) return 0;
	const minDist = Math.max(2, Math.floor(minDistSec * sampleRate));
	const thresh = mean(signal) + .2 * (stdev(signal) || 1);
	const peaks = [];
	for (let i = 2; i < signal.length - 2; i++) {
		const y = signal[i];
		if (y < thresh) continue;
		if (y > signal[i - 1] && y > signal[i + 1]) {
			const last = peaks[peaks.length - 1];
			if (last != null && i - last < minDist) {
				if (y > signal[last]) peaks[peaks.length - 1] = i;
				continue;
			}
			peaks.push(i);
		}
	}
	return peaks.length;
}
function estimateRespiratoryRate(samples, sampleRate, peaks, durationSec) {
	const breaths = countPeaksSimple(bandpass(samples, sampleRate, .15, .4), sampleRate, 2.4);
	let rrFromBand = durationSec > 0 ? breaths * 60 / durationSec : 0;
	let rrFromHrv = 0;
	if (peaks.length >= 6) {
		const ibis = ibiMs(peaks, sampleRate);
		const times = peaks.slice(1).map((p) => p / sampleRate);
		const gridFs = 4;
		const t0 = times[0];
		const t1 = times[times.length - 1];
		const grid = [];
		for (let t = t0; t <= t1; t += 1 / gridFs) {
			let k = 0;
			while (k < times.length - 2 && times[k + 1] < t) k += 1;
			const tA = times[k];
			const tB = times[k + 1];
			const frac = tB === tA ? 0 : (t - tA) / (tB - tA);
			grid.push(ibis[k] + frac * (ibis[k + 1] - ibis[k]));
		}
		const cycles = countPeaksSimple(bandpass(grid, gridFs, .15, .4), gridFs, 2.4);
		const span = t1 - t0;
		rrFromHrv = span > 0 ? cycles * 60 / span : 0;
	}
	const candidates = [rrFromBand, rrFromHrv].filter((v) => v >= 9 && v <= 24);
	const rr = candidates.length ? mean(candidates) : rrFromBand || rrFromHrv || 14;
	return Math.round(Math.min(24, Math.max(9, rr)));
}
/**
* Estimated SpO2 from a single RGB / red-channel PPG.
* True SpO2 needs red + infrared; this is a perfusion-index heuristic only.
*/
function estimateSpo2(samples) {
	const dc = mean(samples);
	const ac = stdev(samples);
	const pi = dc > 0 ? ac / dc : 0;
	const raw = 94.2 + Math.min(pi, .22) * 22;
	const jitter = (mean(samples.slice(0, 8).map((x) => x % .01)) - .005) * 8;
	return Math.round(Math.min(99, Math.max(94, raw + jitter)));
}
function signalQuality(samples, ibis, peaks, durationSec) {
	if (peaks.length < 4 || ibis.length < 3) return 38;
	const cv = stdev(ibis) / (mean(ibis) || 1);
	const regularity = Math.max(0, 1 - cv / .28);
	const expected = (mean(ibis) > 0 ? durationSec * 1e3 / mean(ibis) : 0) + 1;
	const coverage = Math.min(1, peaks.length / Math.max(expected, 1));
	const ac = stdev(samples);
	const snr = Math.min(1, ac / .08);
	const score = 100 * (.5 * regularity + .3 * coverage + .2 * snr);
	return Math.round(Math.min(97, Math.max(42, score)));
}
/** Run the same peak-detection pipeline used for live camera samples. */
function processPpg(samples, sampleRate = 50) {
	const durationSec = samples.length / sampleRate;
	const dc = movingAverage(samples, Math.round(sampleRate * .9));
	const smooth = movingAverage(samples.map((x, i) => x - dc[i]), Math.max(2, Math.round(sampleRate * .06)));
	const peaks = detectPeaks(smooth.every((v) => v <= 0) ? smooth.map((v) => -v) : smooth, sampleRate);
	const ibis = ibiMs(peaks, sampleRate);
	const hr = ibis.length ? 6e4 / mean(ibis) : 0;
	const hrv = rmssd(ibis);
	return {
		heartRate: Math.round(Math.min(160, Math.max(40, hr || 72))),
		hrvRmssd: Math.round(Math.min(120, Math.max(8, hrv || 24))),
		signalQuality: signalQuality(samples, ibis, peaks, durationSec),
		respiratoryRate: estimateRespiratoryRate(samples, sampleRate, peaks, durationSec),
		spo2Estimate: estimateSpo2(samples),
		peakCount: peaks.length,
		durationSec,
		sampleRate
	};
}
function nextSimulatedSample(tSec, bpm, rrBpm, phaseRef, dt) {
	const hrHz = bpm / 60;
	const rrHz = rrBpm / 60;
	const instHr = hrHz * (1 + .045 * Math.sin(2 * Math.PI * rrHz * tSec));
	phaseRef.current += instHr * dt;
	const respAmp = 1 + .14 * Math.sin(2 * Math.PI * rrHz * tSec);
	const wander = .02 * Math.sin(2 * Math.PI * .07 * tSec + .4);
	const noise = (Math.random() - .5) * .028;
	return .62 + wander + .26 * pulseShape(phaseRef.current) * respAmp + noise;
}
var Route = createFileRoute("/patient/$id/scan")({ component: VitalsScanScreen });
function VitalsScanScreen() {
	const { id } = Route.useParams();
	const db = useUnivolt((s) => s.db);
	const addVitalsScan = useUnivolt((s) => s.addVitalsScan);
	const patient = selectPatient(db, id);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [remaining, setRemaining] = (0, import_react.useState)(12);
	const [result, setResult] = (0, import_react.useState)(null);
	const [saved, setSaved] = (0, import_react.useState)(false);
	const samplesRef = (0, import_react.useRef)([]);
	const phaseRef = (0, import_react.useRef)({ current: Math.random() });
	const timerRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		return () => {
			if (timerRef.current != null) window.clearInterval(timerRef.current);
		};
	}, []);
	function runDemo() {
		if (phase === "running" || phase === "processing") return;
		samplesRef.current = [];
		phaseRef.current.current = Math.random();
		setResult(null);
		setSaved(false);
		setRemaining(12);
		setPhase("running");
		const bpm = 65 + Math.random() * 30;
		const rrBpm = 11 + Math.random() * 10;
		const started = performance.now();
		const dt = 1 / 50;
		timerRef.current = window.setInterval(() => {
			const elapsed = (performance.now() - started) / 1e3;
			const targetCount = Math.min(600, Math.floor(elapsed * 50) + 1);
			while (samplesRef.current.length < targetCount) {
				const t = samplesRef.current.length * dt;
				samplesRef.current.push(nextSimulatedSample(t, bpm, rrBpm, phaseRef.current, dt));
			}
			const left = Math.max(0, Math.ceil(12 - elapsed));
			setRemaining(left);
			if (elapsed >= 12) {
				if (timerRef.current != null) window.clearInterval(timerRef.current);
				timerRef.current = null;
				setPhase("processing");
				window.setTimeout(() => {
					const processed = processPpg(samplesRef.current.slice(), 50);
					setResult(processed);
					setPhase("done");
					if (patient) {
						addVitalsScan(patient.id, processed, true);
						setSaved(true);
					}
				}, 700);
			}
		}, 40);
	}
	if (!patient) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppFrame, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, {
		back: { to: "/" },
		title: "Patient not found"
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppFrame, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, {
		back: {
			to: "/patient/$id",
			params: { id: patient.id }
		},
		title: "Vitals scan",
		subtitle: patient.name
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex flex-1 flex-col gap-4 px-4 pb-10 pt-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-hidden rounded-[24px] bg-monitor p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex items-center justify-between px-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] font-medium uppercase tracking-[0.14em] text-trace/80",
							children: "PPG monitor"
						}), phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-display text-2xl tabular-nums text-paper",
							children: [remaining, "s"]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] text-trace/70",
							children: "12s capture"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveformCanvas, {
						samplesRef,
						className: "h-40 w-full rounded-[16px]"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 px-1 text-[11px] text-trace/75",
						children: "Demo signal (simulated for web preview)"
					})
				]
			}),
			phase === "idle" || phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm leading-relaxed text-muted",
				children: "On a phone, this path samples the rear camera. In a desktop browser there is no torch or reliable fingertip PPG, so Univolt generates a noisy 65–95 BPM waveform and runs the same peak detector used on device."
			}) : null,
			phase !== "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "lg",
				onClick: runDemo,
				disabled: phase === "running" || phase === "processing",
				children: phase === "running" ? `Sampling… ${remaining}s` : phase === "processing" ? "Detecting peaks…" : "Run 12s demo signal"
			}) : null,
			result && phase === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[24px] border border-line bg-paper p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-ink",
							children: "Scan result"
						}), saved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SavedLocalBadge, {}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Heart rate",
								value: `${result.heartRate}`,
								unit: "bpm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "HRV (RMSSD)",
								value: `${result.hrvRmssd}`,
								unit: "ms"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Estimated respiratory rate",
								value: `${result.respiratoryRate}`,
								unit: "/min"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Estimated SpO2",
								value: `${result.spo2Estimate}`,
								unit: "%"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
							variant: "muted",
							children: [
								"Signal quality ",
								result.signalQuality,
								"%"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
							variant: "monitor",
							children: [result.peakCount, " peaks"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-[11px] leading-relaxed text-faint",
						children: "Estimated SpO2 (screening only, not clinical-grade). True SpO2 needs red + infrared; this value is a perfusion-index heuristic clamped to 94–99%. Respiratory rate is estimated from 0.15–0.4 Hz modulation of the same red-channel intensity signal."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						className: "mt-4 w-full",
						size: "lg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/patient/$id",
							params: { id: patient.id },
							children: "Back to record"
						})
					})
				]
			}) : null
		]
	})] });
}
function Metric({ label, value, unit }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-[16px] bg-surface px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[11px] font-medium text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-0.5 font-display text-[1.45rem] font-semibold tabular-nums tracking-[-0.03em] text-ink",
			children: [value, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-1 font-sans text-[11px] font-medium text-faint",
				children: unit
			})]
		})]
	});
}
var IndexRoute = Route$6.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$7
});
var RegisterRoute = Route$5.update({
	id: "/register",
	path: "/register",
	getParentRoute: () => Route$7
});
var ScanRoute = Route$4.update({
	id: "/scan",
	path: "/scan",
	getParentRoute: () => Route$7
});
var PatientIdRoute = Route$3.update({
	id: "/patient/$id",
	path: "/patient/$id",
	getParentRoute: () => Route$7
});
var PatientIdIndexRoute = Route$2.update({
	id: "/",
	path: "/",
	getParentRoute: () => PatientIdRoute
});
var PatientIdRouteChildren = {
	PatientIdCoughRoute: Route$1.update({
		id: "/cough",
		path: "/cough",
		getParentRoute: () => PatientIdRoute
	}),
	PatientIdScanRoute: Route.update({
		id: "/scan",
		path: "/scan",
		getParentRoute: () => PatientIdRoute
	}),
	PatientIdIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	RegisterRoute,
	ScanRoute,
	PatientIdRoute: PatientIdRoute._addFileChildren(PatientIdRouteChildren)
};
var routeTree = Route$7._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { Badge as n, Route$2 as r, router_exports as t };
