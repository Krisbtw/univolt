import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as Plus, r as Search, t as X } from "../_libs/lucide-react.mjs";
import { c as latestScan, f as useUnivolt, i as Button, n as AppHeader, s as latestCough, t as AppFrame } from "./button-ByDeNH4n.mjs";
import { n as Badge } from "./router-ucQu3KjV.mjs";
import { t as formatDistanceToNow } from "../_libs/date-fns.mjs";
import { t as Input } from "./input-BUH0iW8R.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DIhbfeZ2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function HomeScreen() {
	const db = useUnivolt((s) => s.db);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const filtered = (0, import_react.useMemo)(() => {
		const q = searchQuery.trim().toLowerCase();
		const list = [...db.patients].sort((a, b) => b.lastVisitAt - a.lastVisitAt);
		if (!q) return list;
		return list.filter((p) => p.name.toLowerCase().includes(q) || p.caseId.toLowerCase().includes(q));
	}, [db.patients, searchQuery]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppFrame, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, { subtitle: `${db.patients.length} patients in this catchment` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex flex-1 flex-col px-4 pb-8 pt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "roster-search",
						value: searchQuery,
						onChange: (e) => setSearchQuery(e.target.value),
						placeholder: "Search name or patient ID",
						"aria-label": "Search roster",
						className: "pl-10 pr-11"
					}),
					searchQuery ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						id: "clear-search",
						"aria-label": "Clear search",
						onClick: () => setSearchQuery(""),
						className: "absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted hover:bg-bg",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-2xl font-semibold tracking-[-0.03em] text-ink",
					children: "Field roster"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/register",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), "Register"]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 flex flex-col gap-2.5",
				children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "rounded-[20px] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-muted",
					children: searchQuery ? `No patients match “${searchQuery}”.` : "Roster is empty. Register a patient to begin."
				}) : filtered.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PatientRow, { patient: p }, p.id))
			})
		]
	})] });
}
function PatientRow({ patient }) {
	const db = useUnivolt((s) => s.db);
	const scan = latestScan(db, patient.id);
	const cough = latestCough(db, patient.id);
	const followUp = cough?.classification !== "Normal" && cough != null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/patient/$id",
		params: { id: patient.id },
		className: "block rounded-[20px] border border-line bg-paper p-4 no-underline transition-colors hover:border-pine/30",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[0.98rem] font-semibold text-ink",
					children: patient.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-sm text-muted",
					children: [
						patient.village,
						" · ",
						patient.age,
						patient.sex
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: "muted",
					children: patient.caseId
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Last visit ", formatDistanceToNow(patient.lastVisitAt, { addSuffix: true })] }), scan ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-medium tabular-nums text-ink",
					children: [
						"HR ",
						scan.heartRate,
						" · RR ",
						scan.respiratoryRate,
						" · SpO2 ",
						scan.spo2Estimate,
						"%"
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "No vitals yet" })]
			}),
			followUp ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[12px] font-medium text-warn",
				children: "Cough screen flagged for follow-up"
			}) : null
		]
	}) });
}
//#endregion
export { HomeScreen as component };
