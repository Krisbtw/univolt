import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { _ as Link, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Mic, c as Activity } from "../_libs/lucide-react.mjs";
import { a as SavedLocalBadge, d as selectScans, f as useUnivolt, i as Button, l as selectCoughs, n as AppHeader, s as latestCough, t as AppFrame, u as selectPatient } from "./button-ByDeNH4n.mjs";
import { n as Badge, r as Route$2 } from "./router-ucQu3KjV.mjs";
import { n as format, t as formatDistanceToNow } from "../_libs/date-fns.mjs";
import { n as Line, r as ResponsiveContainer, t as LineChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/patient._id.index-uHlkg99Z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function TrendChart({ scans }) {
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setReady(true), []);
	const data = scans.map((s) => ({
		t: format(s.capturedAt, "d MMM"),
		hr: s.heartRate,
		rr: s.respiratoryRate,
		spo2: s.spo2Estimate
	}));
	if (scans.length < 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-1 py-6 text-sm text-muted",
		children: "Charts appear after two or more scans. Run a vitals capture to start a trend."
	});
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-52 rounded-[16px] bg-paper" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spark, {
				data,
				dataKey: "hr",
				color: "var(--color-pine)",
				label: "Heart rate",
				unit: " bpm"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spark, {
				data,
				dataKey: "rr",
				color: "var(--color-warn)",
				label: "Est. respiratory rate",
				unit: "/min"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spark, {
				data,
				dataKey: "spo2",
				color: "var(--color-moss)",
				label: "Est. SpO2",
				unit: "%"
			})
		]
	});
}
function Spark({ data, dataKey, color, label, unit }) {
	const last = data[data.length - 1]?.[dataKey];
	const first = data[0]?.[dataKey];
	const delta = last != null && first != null ? last - first : 0;
	const deltaLabel = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-baseline justify-between gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[11px] font-medium text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-[12px] font-medium tabular-nums text-ink",
			children: [
				last,
				unit,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-1.5 text-faint",
					children: deltaLabel
				})
			]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "h-14 w-full",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LineChart, {
				data,
				margin: {
					top: 6,
					right: 6,
					left: 6,
					bottom: 2
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Line, {
					type: "monotone",
					dataKey,
					stroke: color,
					strokeWidth: 2,
					dot: {
						r: 2.5,
						strokeWidth: 0,
						fill: color
					},
					isAnimationActive: false
				})
			})
		})
	})] });
}
function PatientProfileScreen() {
	const { id } = Route$2.useParams();
	const db = useUnivolt((s) => s.db);
	const patient = selectPatient(db, id);
	const scans = selectScans(db, id);
	const coughs = selectCoughs(db, id);
	const lastCough = latestCough(db, id);
	if (!patient) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppFrame, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, {
		back: { to: "/" },
		title: "Patient not found"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-4 pt-6 text-sm text-muted",
		children: "This record is not on this device."
	})] });
	const lastScan = scans[scans.length - 1];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppFrame, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, { back: { to: "/" } }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex flex-1 flex-col gap-4 px-4 pb-10 pt-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-[24px] border border-line bg-paper p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] text-ink",
						children: patient.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
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
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-[12px] text-muted",
					children: ["Last visit ", formatDistanceToNow(patient.lastVisitAt, { addSuffix: true })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "lg",
					className: "h-auto flex-col items-start gap-1 px-4 py-3.5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/patient/$id/scan",
						params: { id: patient.id },
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-left text-sm font-semibold",
							children: "Start vitals scan"
						})]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "secondary",
					size: "lg",
					className: "h-auto flex-col items-start gap-1 px-4 py-3.5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/patient/$id/cough",
						params: { id: patient.id },
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-left text-sm font-semibold",
							children: "Cough screening"
						})]
					})
				})]
			}),
			lastScan ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[24px] border border-line bg-paper p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-ink",
							children: "Latest vitals"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SavedLocalBadge, {})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Heart rate",
								value: `${lastScan.heartRate}`,
								unit: "bpm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "HRV (RMSSD)",
								value: `${lastScan.hrvRmssd}`,
								unit: "ms"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Est. respiratory rate",
								value: `${lastScan.respiratoryRate}`,
								unit: "/min"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
								label: "Est. SpO2",
								value: `${lastScan.spo2Estimate}`,
								unit: "%"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-[11px] leading-relaxed text-faint",
						children: "Estimated SpO2 is screening only, not clinical-grade. A single RGB camera cannot replace red + infrared pulse oximetry."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-center justify-between text-[12px] text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"Signal quality ",
							lastScan.signalQuality,
							"%"
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: format(lastScan.capturedAt, "d MMM, HH:mm") })]
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[24px] border border-line bg-paper p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-1 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-ink",
						children: "Trend"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] text-faint",
						children: "HR · RR · SpO2"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendChart, { scans })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-[24px] border border-line bg-paper p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold text-ink",
						children: "Cough screening"
					}),
					lastCough ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: lastCough.classification === "Normal" ? "ok" : "warn",
								children: lastCough.classification === "Normal" ? "Normal" : "Follow-up"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm leading-relaxed text-ink",
								children: lastCough.classification
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-[11px] text-faint",
								children: ["Prototype heuristic — not a diagnostic classifier. ", format(lastCough.capturedAt, "d MMM, HH:mm")]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "No cough screen on file."
					}),
					coughs.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 divide-y divide-line text-[12px] text-muted",
						children: coughs.slice().reverse().slice(0, 4).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex justify-between gap-3 py-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: c.classification === "Normal" ? "Normal" : "Follow-up" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: format(c.capturedAt, "d MMM") })]
						}, c.id))
					}) : null
				]
			})
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
//#endregion
export { PatientProfileScreen as component };
