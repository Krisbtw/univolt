import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { b as require_jsx_runtime, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { f as useUnivolt, i as Button, n as AppHeader, t as AppFrame } from "./button-ByDeNH4n.mjs";
import { t as Input } from "./input-BUH0iW8R.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/register-KG4S76Op.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RegisterScreen() {
	const addPatient = useUnivolt((s) => s.addPatient);
	const navigate = useNavigate();
	const [name, setName] = (0, import_react.useState)("");
	const [village, setVillage] = (0, import_react.useState)("");
	const [age, setAge] = (0, import_react.useState)("42");
	const [sex, setSex] = (0, import_react.useState)("F");
	function onSubmit(e) {
		e.preventDefault();
		const parsedAge = Number(age);
		if (!name.trim() || !village.trim() || !Number.isFinite(parsedAge) || parsedAge < 0) return;
		const patient = addPatient({
			name: name.trim(),
			village: village.trim(),
			age: Math.round(parsedAge),
			sex
		});
		navigate({
			to: "/patient/$id",
			params: { id: patient.id }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppFrame, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppHeader, {
		back: { to: "/" },
		title: "Register patient",
		subtitle: "Stored only on this device."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		onSubmit,
		className: "flex flex-1 flex-col gap-4 px-4 pb-8 pt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mb-1.5 block text-sm font-medium text-ink",
					children: "Full name"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: name,
					onChange: (e) => setName(e.target.value),
					required: true,
					placeholder: "e.g. Kavita Joshi"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mb-1.5 block text-sm font-medium text-ink",
					children: "Village"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: village,
					onChange: (e) => setVillage(e.target.value),
					required: true,
					placeholder: "e.g. Sikar"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mb-1.5 block text-sm font-medium text-ink",
						children: "Age"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						min: 0,
						max: 120,
						value: age,
						onChange: (e) => setAge(e.target.value),
						required: true
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
						className: "mb-1.5 text-sm font-medium text-ink",
						children: "Sex"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex h-11 overflow-hidden rounded-[12px] border border-line bg-paper",
						children: [
							"F",
							"M",
							"X"
						].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setSex(opt),
							className: `flex-1 text-sm font-medium ${sex === opt ? "bg-pine text-pine-fg" : "text-muted hover:bg-surface"}`,
							children: opt
						}, opt))
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				size: "lg",
				className: "mt-2",
				children: "Save to roster"
			})
		]
	})] });
}
//#endregion
export { RegisterScreen as component };
