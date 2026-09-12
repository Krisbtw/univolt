import { useRef, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useFetTest } from "../hooks/useFetTest";
import { classifyFet, type FetClassification } from "../lib/breathAudioEngine";
import type { FetPhase } from "../hooks/useFetTest";

// ── Classification display ────────────────────────────────────────────────────

function classLabel(c: FetClassification): { label: string; color: string; emoji: string } {
  switch (c) {
    case "normal":       return { label: "Normal (< 4 s)",              color: "#4ade80", emoji: "✅" };
    case "borderline":   return { label: "Borderline (4–6 s)",          color: "#fbbf24", emoji: "⚠️" };
    case "obstruction":  return { label: "Possible obstruction (> 6 s)", color: "#f87171", emoji: "🚨" };
    case "reject":       return { label: "Unable to detect",            color: "#64748b", emoji: "❌" };
  }
}

function phaseLabel(phase: FetPhase): string {
  switch (phase) {
    case "idle":        return "Ready to start";
    case "calibrating": return "Calibrating microphone…";
    case "instruction": return "Take a deep breath, then blow all the air out!";
    case "recording":   return "Recording — keep blowing!";
    case "between":     return "Trial 1 done. Preparing trial 2…";
    case "done":        return "Test complete";
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function FetTestScreen() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useFetTest({ canvasRef });

  const { phase, permission, trial, liveSec, result } = state;
  const denied = permission === "denied" || permission === "unsupported";
  const bestClass = result?.bestSec != null ? classifyFet(result.bestSec) : null;

  return (
    <div style={screenStyle}>
      <div style={wrapStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>🫁 Breathing Time Test</h1>
          <Link to={("/fusion") as any} style={navLinkStyle}>Triage summary →</Link>
        </div>

        <p style={subStyle}>
          Forced Expiratory Time (FET) — a WHO-endorsed bedside airway obstruction screen.
        </p>

        {/* Mic denied */}
        {denied && (
          <div style={deniedCardStyle}>
            <p style={deniedTitleStyle}>🎤 Microphone access blocked</p>
            <p style={deniedBodyStyle}>
              This test needs microphone access to measure your breathing time. Please enable the microphone in your browser settings and try again.
            </p>
          </div>
        )}

        {/* Instruction */}
        {(phase === "idle" || phase === "instruction" || phase === "calibrating") && (
          <div style={instructionCardStyle}>
            <p style={instructionStyle}>
              Take the deepest breath you can, then blow ALL the air out through your open mouth until your lungs feel empty.
            </p>
            <p style={phaseStatusStyle}>{phaseLabel(phase)}</p>
          </div>
        )}

        {/* Status & live timer */}
        <div style={statusRowStyle}>
          <span style={phaseChipStyle(phase)}>{phaseLabel(phase)}</span>
          {phase === "recording" && (
            <span style={timerStyle}>{liveSec.toFixed(1)} s</span>
          )}
          {result != null && phase !== "done" && (
            <span style={{ fontSize: 13, color: "#64748b" }}>Trial {trial + 1} / 2</span>
          )}
        </div>

        {/* Canvas envelope */}
        <div style={canvasWrapStyle}>
          <canvas ref={canvasRef} width={600} height={120} style={canvasStyle} />
          {phase === "idle" && (
            <div style={canvasPlaceholderStyle}>Envelope will appear here during recording</div>
          )}
        </div>

        {/* Controls */}
        <div style={controlsRowStyle}>
          {(phase === "idle") && (
            <button id="btn-fet-start" style={primaryBtnStyle} onClick={() => actions.startTest()}>
              🎤 Start Test
            </button>
          )}
          {phase === "instruction" && (
            <button id="btn-fet-force" style={primaryBtnStyle} onClick={() => actions.forceStart()}>
              ▶ Start Blowing Now
            </button>
          )}
          {(phase === "done" || denied) && (
            <button id="btn-fet-retry" style={secondaryBtnStyle} onClick={() => actions.reset()}>
              🔄 Retry
            </button>
          )}
        </div>

        {/* Result */}
        {result != null && (
          <div style={resultCardStyle}>
            <h2 style={resultTitleStyle}>Result</h2>
            <div style={trialsRowStyle}>
              {result.trialSecs.map((s, i) => {
                const c = classifyFet(s);
                const cl = classLabel(c);
                return (
                  <div key={i} style={{ ...trialBadgeStyle, borderColor: cl.color + "55" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Trial {i + 1}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: cl.color }}>{s.toFixed(1)} s</span>
                    <span style={{ fontSize: 11, color: cl.color }}>{cl.emoji} {c}</span>
                  </div>
                );
              })}
            </div>
            {result.bestSec != null && bestClass != null ? (
              (() => {
                const cl = classLabel(bestClass);
                return (
                  <div style={{ ...bestResultStyle, background: cl.color + "18", border: `1px solid ${cl.color}44` }}>
                    <span style={{ fontSize: 28 }}>{cl.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: cl.color }}>{cl.label}</p>
                      <p style={{ margin: "3px 0 0", fontSize: 13, color: "#94a3b8" }}>Best: {result.bestSec.toFixed(1)} s · Quality: {result.quality}</p>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p style={{ color: "#64748b", fontSize: 13 }}>Unable to detect a valid exhalation. Please retry.</p>
            )}
            <Link to={("/fusion") as any} style={ctaLinkStyle}>View triage summary →</Link>
          </div>
        )}

        <p style={disclaimerStyle}>Not a medical device. For screening and education only.</p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const screenStyle: CSSProperties = { minHeight: "100vh", background: "#0b1120", color: "#e2e8f0", fontFamily: 'system-ui,"Segoe UI",sans-serif', padding: "20px 16px 48px", boxSizing: "border-box" };
const wrapStyle: CSSProperties = { maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700 };
const navLinkStyle: CSSProperties = { color: "#34d399", fontSize: 13, textDecoration: "none" };
const subStyle: CSSProperties = { margin: 0, fontSize: 13, color: "#64748b" };
const deniedCardStyle: CSSProperties = { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 12, padding: "14px 16px" };
const deniedTitleStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: "#f87171" };
const deniedBodyStyle: CSSProperties = { margin: "6px 0 0", fontSize: 13, color: "#fca5a5" };
const instructionCardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 16px" };
const instructionStyle: CSSProperties = { margin: 0, fontSize: 15, color: "#e2e8f0", lineHeight: 1.55, fontStyle: "italic" };
const phaseStatusStyle: CSSProperties = { margin: "10px 0 0", fontSize: 12, color: "#64748b" };
const statusRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const timerStyle: CSSProperties = { fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#34d399" };
function phaseChipStyle(phase: FetPhase): CSSProperties {
  const color = phase === "recording" ? "#34d399" : phase === "done" ? "#4ade80" : "#64748b";
  return { fontSize: 12, fontWeight: 600, color, background: color + "18", border: `1px solid ${color}44`, borderRadius: 20, padding: "4px 10px" };
}
const canvasWrapStyle: CSSProperties = { position: "relative", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" };
const canvasStyle: CSSProperties = { display: "block", width: "100%", height: "auto" };
const canvasPlaceholderStyle: CSSProperties = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 12, color: "#334155", pointerEvents: "none" };
const controlsRowStyle: CSSProperties = { display: "flex", gap: 10 };
const primaryBtnStyle: CSSProperties = { flex: 1, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const secondaryBtnStyle: CSSProperties = { flex: 1, background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer" };
const resultCardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 };
const resultTitleStyle: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" };
const trialsRowStyle: CSSProperties = { display: "flex", gap: 10 };
const trialBadgeStyle: CSSProperties = { flex: 1, background: "#020617", border: "1px solid", borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 3 };
const bestResultStyle: CSSProperties = { borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 };
const ctaLinkStyle: CSSProperties = { background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" };
const disclaimerStyle: CSSProperties = { margin: 0, fontSize: 11, color: "#475569", textAlign: "center" };
