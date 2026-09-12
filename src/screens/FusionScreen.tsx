import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { evaluateFusion, type FusionLevel, type FusionReason } from "../lib/fusionEngine";
import { useFusionSession } from "../lib/fusionStore";
import { classifyFet } from "../lib/breathAudioEngine";

// ── Reason code → human-readable label (en only for now) ────────────────────

const REASON_LABELS: Record<string, string> = {
  bpm_extreme: "Heart rate > 150 bpm",
  shock_pattern: "Fast HR + prolonged CRT (shock pattern)",
  chest_pain: "Chest pain reported",
  fainting: "Fainting / loss of consciousness",
  bleeding: "Active bleeding reported",
  fet_obstruction: "Breathing time > 6 s (airway obstruction)",
  tachycardia: "Heart rate > 100 bpm",
  bradycardia: "Heart rate < 50 bpm",
  tachypnea: "Breathing rate > 24 /min",
  crt_elevated: "Capillary refill time 3–5 s",
  pregnant_abnormal: "Pregnancy + abnormal signal",
  fever_3d: "Fever ≥ 3 days",
  breathless: "Breathlessness reported",
  all_normal: "All measured signals in normal range",
};

function labelFor(reason: FusionReason): string {
  return REASON_LABELS[reason.code] ?? reason.code;
}

// ── Level styling ─────────────────────────────────────────────────────────────

function levelStyle(level: FusionLevel): { bg: string; border: string; color: string; emoji: string; label: string } {
  switch (level) {
    case "urgent":
      return { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.4)", color: "#f87171", emoji: "🚨", label: "URGENT — Go now" };
    case "phc_today":
      return { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.4)", color: "#fbbf24", emoji: "⚠️", label: "Visit PHC today" };
    case "self_care":
      return { bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.4)", color: "#4ade80", emoji: "✅", label: "Self-care at home" };
    case "insufficient_data":
      return { bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.35)", color: "#94a3b8", emoji: "ℹ️", label: "Insufficient data" };
  }
}

// ── Questionnaire form ────────────────────────────────────────────────────────

export function FusionScreen() {
  const session = useFusionSession();

  // Local questionnaire state
  const [age, setAge] = useState(session.ageYears?.toString() ?? "");
  const [pregnant, setPregnant] = useState(session.pregnant ?? false);
  const [breathless, setBreathless] = useState(session.symptoms?.breathless ?? false);
  const [chestPain, setChestPain] = useState(session.symptoms?.chestPain ?? false);
  const [fainting, setFainting] = useState(session.symptoms?.fainting ?? false);
  const [bleeding, setBleeding] = useState(session.symptoms?.bleeding ?? false);
  const [feverDays, setFeverDays] = useState(session.symptoms?.feverDays?.toString() ?? "");

  // Build inputs live (no Submit button — reactive)
  const inputs = useMemo(() => ({
    ageYears: age ? parseInt(age, 10) : undefined,
    pregnant,
    symptoms: {
      breathless,
      chestPain,
      fainting,
      bleeding,
      feverDays: feverDays ? parseInt(feverDays, 10) : undefined,
    },
    rppg: session.rppg,
    crtSec: session.crtSec,
    fetSec: session.fetSec,
  }), [age, pregnant, breathless, chestPain, fainting, bleeding, feverDays, session.rppg, session.crtSec, session.fetSec]);

  const result = useMemo(() => evaluateFusion(inputs), [inputs]);
  const ls = levelStyle(result.level);

  const fetClass = session.fetSec != null ? classifyFet(session.fetSec) : null;

  return (
    <div style={screenStyle}>
      <div style={wrapStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>🩺 Triage Summary</h1>
          <Link to="/scan" style={navLinkStyle}>← Back to scan</Link>
        </div>

        {/* Level card */}
        <div style={{ ...levelCardStyle, background: ls.bg, border: `1px solid ${ls.border}` }}>
          <span style={levelEmojiStyle}>{ls.emoji}</span>
          <div>
            <p style={{ ...levelLabelStyle, color: ls.color }}>{ls.label}</p>
            <p style={signalsUsedStyle}>{result.signalsUsed} signal{result.signalsUsed !== 1 ? "s" : ""} used</p>
          </div>
        </div>

        {/* Signals collected */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Collected signals</h2>
          <div style={signalsGridStyle}>
            {session.rppg ? (
              <SignalBadge
                label="rPPG"
                value={session.rppg.bpm != null ? `${session.rppg.bpm} bpm` : "No HR"}
                quality={session.rppg.quality}
              />
            ) : <SignalBadge label="rPPG" value="Not measured" quality="reject" />}
            {session.fetSec != null ? (
              <SignalBadge
                label="FET"
                value={`${session.fetSec.toFixed(1)} s`}
                quality={fetClass === "reject" ? "reject" : fetClass === "obstruction" ? "weak" : "good"}
              />
            ) : <SignalBadge label="FET" value="Not measured" quality="reject" />}
            {session.crtSec != null ? (
              <SignalBadge label="CRT" value={`${session.crtSec.toFixed(1)} s`} quality="good" />
            ) : <SignalBadge label="CRT" value="Not measured" quality="reject" />}
          </div>
        </div>

        {/* Questionnaire */}
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Questionnaire</h2>
          <label style={labelStyle}>
            Age (years)
            <input type="number" min={0} max={120} value={age} onChange={e => setAge(e.target.value)} style={inputStyle} inputMode="numeric" placeholder="--" />
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={pregnant} onChange={e => setPregnant(e.target.checked)} style={{ marginRight: 8 }} />
            Currently pregnant
          </label>
          <p style={symHeadStyle}>Symptoms</p>
          {([
            ["breathless", "Breathlessness", breathless, setBreathless],
            ["chestPain", "Chest pain", chestPain, setChestPain],
            ["fainting", "Fainting / loss of consciousness", fainting, setFainting],
            ["bleeding", "Bleeding (external)", bleeding, setBleeding],
          ] as const).map(([, sym, val, set]) => (
            <label key={sym} style={checkboxLabelStyle}>
              <input type="checkbox" checked={val as boolean} onChange={e => (set as (v: boolean) => void)(e.target.checked)} style={{ marginRight: 8 }} />
              {sym}
            </label>
          ))}
          <label style={labelStyle}>
            Days of fever
            <input type="number" min={0} max={30} value={feverDays} onChange={e => setFeverDays(e.target.value)} style={inputStyle} inputMode="numeric" placeholder="0" />
          </label>
        </div>

        {/* Reasons */}
        {result.reasons.length > 0 && (
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Reasons</h2>
            <ul style={reasonsListStyle}>
              {result.reasons.map(r => (
                <li key={r.code} style={reasonItemStyle}>
                  <span style={reasonDotStyle(r.weight)} />
                  {labelFor(r)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nav to FET */}
        <div style={navRowStyle}>
          <Link to={("/fet") as any} style={ctaLinkStyle}>🫁 Run Breathing Time Test</Link>
        </div>

        <p style={disclaimerStyle}>Not a medical device. For screening and education only.</p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SignalBadge({ label, value, quality }: { label: string; value: string; quality: "good" | "weak" | "reject" }) {
  const color = quality === "good" ? "#4ade80" : quality === "weak" ? "#fbbf24" : "#64748b";
  return (
    <div style={{ background: "#0f172a", border: `1px solid ${color}44`, borderRadius: 10, padding: "10px 14px" }}>
      <p style={{ margin: 0, fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>{value}</p>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{quality.toUpperCase()}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const screenStyle: CSSProperties = { minHeight: "100vh", background: "#0b1120", color: "#e2e8f0", fontFamily: 'system-ui,"Segoe UI",sans-serif', padding: "20px 16px 48px", boxSizing: "border-box" };
const wrapStyle: CSSProperties = { maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700 };
const navLinkStyle: CSSProperties = { color: "#34d399", fontSize: 13, textDecoration: "none" };
const levelCardStyle: CSSProperties = { borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 };
const levelEmojiStyle: CSSProperties = { fontSize: 36 };
const levelLabelStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700 };
const signalsUsedStyle: CSSProperties = { margin: "3px 0 0", fontSize: 12, color: "#64748b" };
const sectionStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" };
const signalsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 };
const labelStyle: CSSProperties = { fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "flex", flexDirection: "column", gap: 4 };
const inputStyle: CSSProperties = { background: "#020617", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", fontSize: 15, color: "#e2e8f0", boxSizing: "border-box" };
const checkboxLabelStyle: CSSProperties = { fontSize: 13, color: "#cbd5e1", display: "flex", alignItems: "center", cursor: "pointer" };
const symHeadStyle: CSSProperties = { margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" };
const reasonsListStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 };
const reasonItemStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1" };
function reasonDotStyle(weight: number): CSSProperties {
  const color = weight >= 10 ? "#f87171" : weight >= 5 ? "#fbbf24" : "#4ade80";
  return { width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 };
}
const navRowStyle: CSSProperties = { display: "flex", justifyContent: "center" };
const ctaLinkStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 20px", color: "#34d399", fontSize: 14, fontWeight: 600, textDecoration: "none" };
const disclaimerStyle: CSSProperties = { margin: 0, fontSize: 11, color: "#475569", textAlign: "center" };
