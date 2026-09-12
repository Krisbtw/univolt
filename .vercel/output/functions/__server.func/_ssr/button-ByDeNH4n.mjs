import "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as CloudOff, s as ChevronLeft } from "../_libs/lucide-react.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
require_react();
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function UnivoltMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 32 32",
		className: cn("size-8", className),
		"aria-hidden": "true",
		fill: "none",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			width: "32",
			height: "32",
			rx: "8",
			className: "fill-pine"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M6 17h3.2l2.1-6.4 2.8 12.2 3-8.6 1.7 4.2H26",
			className: "stroke-pine-fg",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})]
	});
}
function SyncIndicator({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted", className),
		title: "All records stay on this device. No network is required.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudOff, {
			className: "size-3.5",
			strokeWidth: 1.8
		}), "Offline · on device"]
	});
}
function SavedLocalBadge({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex items-center gap-1 text-[11px] font-medium text-ok", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-ok" }), "Saved locally"]
	});
}
function AppFrame({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-dvh bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface shadow-[0_0_0_1px_var(--color-line)]",
			children
		})
	});
}
function AppHeader({ back, backLabel = "Back", title, subtitle }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "sticky top-0 z-20 border-b border-line/80 bg-surface/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-3",
			children: [back ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: back.to,
				params: back.params,
				className: "inline-flex size-11 items-center justify-center rounded-[12px] text-ink hover:bg-paper",
				"aria-label": backLabel,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-5" })
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/",
				className: "flex items-center gap-2.5 no-underline",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnivoltMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "leading-tight",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-[1.15rem] font-semibold tracking-[-0.03em] text-ink",
						children: "Univolt"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] font-medium uppercase tracking-[0.14em] text-muted",
						children: "Field vitals kit"
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SyncIndicator, {})]
		}), title ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn(back ? "px-1 pt-1" : "pt-3"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-ink",
				children: title
			}), subtitle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted",
				children: subtitle
			}) : null]
		}) : null]
	});
}
function BootScreen() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-dvh items-center justify-center bg-bg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col items-center gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UnivoltMark, { className: "size-12" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-xl font-semibold tracking-[-0.03em] text-ink",
					children: "Univolt"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Loading field roster"
				})
			]
		})
	});
}
var DB_KEY = "univolt.db.v1";
var META_FLAG = "univolt.seeded.v1";
var DB_VERSION = 1;
var memoryDb = null;
function emptyDb() {
	return {
		patients: [],
		scans: [],
		coughs: [],
		meta: {
			seeded: false,
			version: DB_VERSION
		}
	};
}
function storage() {
	if (typeof window === "undefined") return null;
	try {
		const s = window.localStorage;
		const k = "__univolt_probe";
		s.setItem(k, "1");
		s.removeItem(k);
		return s;
	} catch {
		return null;
	}
}
function daysAgo(days, hours = 10) {
	return Date.now() - days * 864e5 - hours * 36e5;
}
function seedPatients() {
	return {
		patients: [
			{
				id: "p-meera",
				caseId: "UV-1042",
				name: "Meera Devi",
				age: 58,
				sex: "F",
				village: "Rampur Kalan",
				createdAt: daysAgo(40, 4),
				lastVisitAt: daysAgo(2, 8)
			},
			{
				id: "p-ramesh",
				caseId: "UV-1088",
				name: "Ramesh Kumar",
				age: 44,
				sex: "M",
				village: "Khetri",
				createdAt: daysAgo(28, 2),
				lastVisitAt: daysAgo(5, 11)
			},
			{
				id: "p-anjali",
				caseId: "UV-1120",
				name: "Anjali Singh",
				age: 26,
				sex: "F",
				village: "Bhilwara",
				createdAt: daysAgo(18, 6),
				lastVisitAt: daysAgo(1, 5)
			}
		],
		scans: [
			scan("s-meera-1", "p-meera", daysAgo(12, 9), 74, 32, 82, 15, 98),
			scan("s-meera-2", "p-meera", daysAgo(7, 7), 78, 28, 76, 16, 97),
			scan("s-meera-3", "p-meera", daysAgo(2, 8), 82, 24, 88, 18, 96),
			scan("s-ramesh-1", "p-ramesh", daysAgo(14, 6), 66, 42, 90, 12, 99),
			scan("s-ramesh-2", "p-ramesh", daysAgo(5, 11), 70, 38, 85, 13, 98),
			scan("s-anjali-1", "p-anjali", daysAgo(9, 4), 88, 22, 70, 19, 97),
			scan("s-anjali-2", "p-anjali", daysAgo(4, 9), 84, 26, 80, 17, 96),
			scan("s-anjali-3", "p-anjali", daysAgo(1, 5), 76, 30, 91, 14, 98)
		],
		coughs: [
			cough("c-meera-1", "p-meera", daysAgo(12, 9), "Normal", false),
			cough("c-meera-2", "p-meera", daysAgo(2, 8), "Possible irregular breathing pattern — refer for clinical follow-up", false),
			cough("c-ramesh-1", "p-ramesh", daysAgo(5, 11), "Normal", false),
			cough("c-anjali-1", "p-anjali", daysAgo(9, 4), "Possible irregular breathing pattern — refer for clinical follow-up", false),
			cough("c-anjali-2", "p-anjali", daysAgo(1, 5), "Normal", false)
		]
	};
}
function scan(id, patientId, capturedAt, heartRate, hrvRmssd, signalQuality, respiratoryRate, spo2Estimate) {
	return {
		id,
		patientId,
		capturedAt,
		heartRate,
		hrvRmssd,
		signalQuality,
		respiratoryRate,
		spo2Estimate,
		peakCount: Math.round(heartRate / 60 * 12),
		durationSec: 12,
		simulated: true,
		syncStatus: "local"
	};
}
function cough(id, patientId, capturedAt, classification, simulated) {
	const irregular = classification !== "Normal";
	return {
		id,
		patientId,
		capturedAt,
		classification,
		zeroCrossingRate: irregular ? 640 : 210,
		energyVariance: irregular ? .0042 : 31e-5,
		durationSec: 6,
		simulated,
		notes: irregular ? "Seeded screening — bursty energy envelope." : "Seeded screening — quiet breathing band.",
		syncStatus: "local"
	};
}
function migrate(raw) {
	const db = raw ?? emptyDb();
	const patients = Array.isArray(db.patients) ? db.patients : [];
	return {
		patients,
		scans: (Array.isArray(db.scans) ? db.scans : []).map((s) => ({
			...s,
			respiratoryRate: s.respiratoryRate ?? 14,
			spo2Estimate: s.spo2Estimate ?? 97,
			hrvRmssd: s.hrvRmssd ?? 28,
			signalQuality: s.signalQuality ?? 80,
			syncStatus: s.syncStatus ?? "local"
		})),
		coughs: Array.isArray(db.coughs) ? db.coughs : [],
		meta: {
			seeded: db.meta?.seeded ?? patients.length > 0,
			version: DB_VERSION
		}
	};
}
function persist(db) {
	memoryDb = db;
	const s = storage();
	if (!s) return;
	s.setItem(DB_KEY, JSON.stringify(db));
	if (db.meta.seeded) s.setItem(META_FLAG, "1");
}
/**
* Web stand-in for the Expo SQLite layer (`database.ts`).
* Stores patients, vitals (including respiratory_rate + spo2_estimate),
* and cough_screening_result locally. Seeds once when the patients table is empty.
*/
function loadOrSeed() {
	if (memoryDb) return memoryDb;
	const s = storage();
	if (s) {
		const existing = s.getItem(DB_KEY);
		if (existing) try {
			const db = migrate(JSON.parse(existing));
			if (db.patients.length > 0) {
				db.meta.seeded = true;
				persist(db);
				return db;
			}
		} catch {}
		if (s.getItem(META_FLAG) === "1") {
			const db = migrate(null);
			persist(db);
			return db;
		}
	} else if (memoryDb) return memoryDb;
	const db = {
		...seedPatients(),
		meta: {
			seeded: true,
			version: DB_VERSION
		}
	};
	persist(db);
	return db;
}
function saveDb(db) {
	persist({
		...db,
		meta: {
			...db.meta,
			version: DB_VERSION
		}
	});
}
function nextCaseId(patients) {
	const nums = patients.map((p) => {
		const m = /^UV-(\d+)$/.exec(p.caseId);
		return m ? Number(m[1]) : 1e3;
	});
	return `UV-${(nums.length ? Math.max(...nums) : 1120) + 1}`;
}
function makeId(prefix) {
	return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}
function newPatientInput(input) {
	const now = Date.now();
	return {
		id: makeId("p"),
		caseId: input.caseId,
		name: input.name.trim(),
		age: input.age,
		sex: input.sex,
		village: input.village.trim(),
		createdAt: now,
		lastVisitAt: now
	};
}
function touchVisit(db, patientId, at) {
	return {
		...db,
		patients: db.patients.map((p) => p.id === patientId ? {
			...p,
			lastVisitAt: at
		} : p)
	};
}
var useUnivolt = create((set, get) => ({
	ready: false,
	db: {
		patients: [],
		scans: [],
		coughs: [],
		meta: {
			seeded: false,
			version: 1
		}
	},
	init: () => {
		if (get().ready) return;
		set({
			db: loadOrSeed(),
			ready: true
		});
	},
	addPatient: (input) => {
		const db = get().db;
		const patient = newPatientInput({
			...input,
			caseId: nextCaseId(db.patients)
		});
		const next = {
			...db,
			patients: [patient, ...db.patients]
		};
		saveDb(next);
		set({ db: next });
		return patient;
	},
	addVitalsScan: (patientId, result, simulated) => {
		const at = Date.now();
		const row = {
			id: makeId("s"),
			patientId,
			capturedAt: at,
			heartRate: result.heartRate,
			hrvRmssd: result.hrvRmssd,
			signalQuality: result.signalQuality,
			respiratoryRate: result.respiratoryRate,
			spo2Estimate: result.spo2Estimate,
			peakCount: result.peakCount,
			durationSec: result.durationSec,
			simulated,
			syncStatus: "local"
		};
		const db = touchVisit(get().db, patientId, at);
		const next = {
			...db,
			scans: [...db.scans, row]
		};
		saveDb(next);
		set({ db: next });
	},
	addCoughScreening: (patientId, result) => {
		const at = Date.now();
		const row = {
			id: makeId("c"),
			patientId,
			capturedAt: at,
			classification: result.classification,
			zeroCrossingRate: result.zeroCrossingRate,
			energyVariance: result.energyVariance,
			durationSec: result.durationSec,
			simulated: result.simulated,
			notes: result.notes,
			syncStatus: "local"
		};
		const db = touchVisit(get().db, patientId, at);
		const next = {
			...db,
			coughs: [...db.coughs, row]
		};
		saveDb(next);
		set({ db: next });
	}
}));
function selectPatient(db, id) {
	return db.patients.find((p) => p.id === id) ?? null;
}
function selectScans(db, patientId) {
	return db.scans.filter((s) => s.patientId === patientId).sort((a, b) => a.capturedAt - b.capturedAt);
}
function selectCoughs(db, patientId) {
	return db.coughs.filter((c) => c.patientId === patientId).sort((a, b) => a.capturedAt - b.capturedAt);
}
function latestScan(db, patientId) {
	const scans = selectScans(db, patientId);
	return scans[scans.length - 1] ?? null;
}
function latestCough(db, patientId) {
	const coughs = selectCoughs(db, patientId);
	return coughs[coughs.length - 1] ?? null;
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,background-color,opacity,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-pine text-pine-fg hover:bg-moss",
			secondary: "bg-paper text-ink border border-line hover:bg-surface",
			outline: "border border-line bg-transparent text-ink hover:bg-paper",
			ghost: "text-ink hover:bg-paper",
			danger: "bg-danger text-paper hover:opacity-90"
		},
		size: {
			default: "h-11 rounded-[12px] px-4 text-sm",
			sm: "h-9 rounded-[10px] px-3 text-sm",
			lg: "h-12 rounded-[14px] px-5 text-[0.9375rem]",
			icon: "size-11 rounded-[12px]"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
function Button({ className, variant, size, asChild = false, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
//#endregion
export { SavedLocalBadge as a, latestScan as c, selectScans as d, useUnivolt as f, Button as i, selectCoughs as l, AppHeader as n, cn as o, BootScreen as r, latestCough as s, AppFrame as t, selectPatient as u };
