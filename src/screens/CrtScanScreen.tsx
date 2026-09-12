import { useRef, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useCrtScan } from "../hooks/useCrtScan";
import { classifyCrt } from "../lib/crtEngine";
import type { CrtScanPhase } from "../hooks/useCrtScan";

// ── Phase helpers ─────────────────────────────────────────────────────────────

function phaseInstruction(phase: CrtScanPhase, crtPhase: string): string {
  switch (phase) {
    case "idle":       return "Initialising camera…";
    case "align":      return "Place your thumbnail in the centre box. Tap \"Ready\" when aligned.";
    case "baseline":   return "Hold still — calibrating baseline…";
    case "press":      return "Press your thumbnail firmly for 5 seconds, then release.";
    case "measuring":
      if (crtPhase === "pressed")  return "Nail pressed — keep pressing…";
      if (crtPhase === "released") return "Release detected — measuring colour recovery…";
      return "Measuring…";
    case "complete":   return "Test complete!";
    case "failed":     return "Unable to detect — please retry.";
  }
}

function classLabel(sec: number): { label: string; color: string; emoji: string } {
  const c = classifyCrt(sec);
  switch (c) {
    case "normal":     return { label: "Normal (< 2 s)",        color: "#4ade80", emoji: "✅" };
    case "borderline": return { label: "Borderline (2–3 s)",    color: "#fbbf24", emoji: "⚠️" };
    case "slow":       return { label: "Slow (≥ 3 s) — refer", color: "#f87171", emoji: "🚨" };
  }
}

// ── ROI overlay (shows nail + control boxes on the video) ─────────────────────

function RoiOverlay() {
  return (
    <div style={overlayStyle}>
      {/* Nail box */}
      <div style={{ ...roiBoxStyle, left: "30%", width: "20%", top: "20%", height: "60%", borderColor: "#34d399" }}>
        <span style={roiLabelStyle}>Nail</span>
      </div>
      {/* Control box */}
      <div style={{ ...roiBoxStyle, left: "55%", width: "20%", top: "20%", height: "60%", borderColor: "#94a3b8" }}>
        <span style={roiLabelStyle}>Control</span>
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function CrtScanScreen() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useCrtScan({ videoRef, waveCanvasRef });

  const { phase, permission, crtPhase, result, failureReason } = state;
  const denied = permission === "denied" || permission === "unsupported";
  const crtClass = result?.crtSec != null ? classLabel(result.crtSec) : null;

  return (
    <div style={screenStyle}>
      <div style={wrapStyle}>
        {/* Header */}
        <div style={headerRowStyle}>
          <h1 style={titleStyle}>💅 Capillary Refill Test</h1>
          <Link to={"/fusion" as any} style={navLinkStyle}>Triage →</Link>
        </div>
        <p style={subStyle}>Camera-based perfusion screen. CRT &gt; 3 s suggests poor perfusion.</p>

        {/* Camera denied */}
        {denied && (
          <div style={deniedCardStyle}>
            <p style={deniedTitleStyle}>📷 Camera access blocked</p>
            <p style={deniedBodyStyle}>Enable the camera in browser settings, then retry.</p>
          </div>
        )}

        {/* Video + ROI overlay */}
        <div style={videoWrapStyle}>
          <video ref={videoRef} autoPlay playsInline muted style={videoStyle} />
          {(phase === "align" || phase === "baseline" || phase === "press" || phase === "measuring") && (
            <RoiOverlay />
          )}
        </div>

        {/* Instruction */}
        <div style={instructionCardStyle}>
          <p style={instructionStyle}>{phaseInstruction(phase, crtPhase)}</p>
          {failureReason && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#f87171" }}>
              Reason: {failureReason.replace(/_/g, " ")}
            </p>
          )}
        </div>

        {/* Waveform */}
        <div style={canvasWrapStyle}>
          <canvas ref={waveCanvasRef} width={600} height={120} style={canvasStyle} />
          <div style={waveLegendStyle}>
            <span style={{ color: "#34d399" }}>● Nail</span>
            <span style={{ color: "#94a3b8", marginLeft: 12 }}>● Control</span>
          </div>
        </div>

        {/* Controls */}
        <div style={controlRowStyle}>
          {phase === "idle" && (
            <button id="btn-crt-start" style={primaryBtnStyle} onClick={() => actions.startCamera()}>
              📷 Start Camera
            </button>
          )}
          {phase === "align" && (
            <button id="btn-crt-ready" style={primaryBtnStyle} onClick={() => actions.startBaseline()}>
              ✅ Ready — aligned
            </button>
          )}
          {(phase === "complete" || phase === "failed") && (
            <button id="btn-crt-retry" style={secondaryBtnStyle} onClick={() => actions.reset()}>
              🔄 Retry
            </button>
          )}
        </div>

        {/* Result */}
        {phase === "complete" && result != null && (
          <div style={resultCardStyle}>
            <h2 style={resultTitleStyle}>Result</h2>
            {result.crtSec != null && crtClass != null ? (
              <>
                <div style={{ ...resultBestStyle, background: crtClass.color + "18", border: `1px solid ${crtClass.color}44` }}>
                  <span style={{ fontSize: 36 }}>{crtClass.emoji}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: crtClass.color }}>
                      {result.crtSec.toFixed(1)} s
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: crtClass.color }}>{crtClass.label}</p>
                  </div>
                </div>
                {/* Threshold reference */}
                <div style={thresholdRowStyle}>
                  {(["< 2 s → Normal", "2–3 s → Borderline", "> 3 s → Refer"] as const).map(t => (
                    <span key={t} style={thresholdChipStyle}>{t}</span>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ color: "#64748b", fontSize: 13 }}>
                Unable to detect. Please retry in brighter, steadier light.
              </p>
            )}
            <Link to={("/fusion") as any} style={ctaLinkStyle}>View triage summary →</Link>
          </div>
        )}

        <p style={disclaimerStyle}>Not a medical device. For screening only.</p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const screenStyle: CSSProperties = {
  minHeight: "100vh", background: "#0b1120", color: "#e2e8f0",
  fontFamily: 'system-ui,"Segoe UI",sans-serif', padding: "20px 16px 48px", boxSizing: "border-box",
};
const wrapStyle: CSSProperties = { maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 };
const headerRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700 };
const navLinkStyle: CSSProperties = { color: "#34d399", fontSize: 13, textDecoration: "none" };
const subStyle: CSSProperties = { margin: 0, fontSize: 13, color: "#64748b" };
const deniedCardStyle: CSSProperties = { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 12, padding: "14px 16px" };
const deniedTitleStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: "#f87171" };
const deniedBodyStyle: CSSProperties = { margin: "6px 0 0", fontSize: 13, color: "#fca5a5" };
const videoWrapStyle: CSSProperties = { position: "relative", background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "4/3" };
const videoStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const overlayStyle: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
const roiBoxStyle: CSSProperties = {
  position: "absolute", border: "2px solid", borderRadius: 4,
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const roiLabelStyle: CSSProperties = { fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: 2, marginBottom: 2 };
const instructionCardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 16px" };
const instructionStyle: CSSProperties = { margin: 0, fontSize: 15, color: "#e2e8f0", lineHeight: 1.55 };
const canvasWrapStyle: CSSProperties = { position: "relative", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" };
const canvasStyle: CSSProperties = { display: "block", width: "100%", height: "auto" };
const waveLegendStyle: CSSProperties = { position: "absolute", bottom: 6, right: 10, fontSize: 11, fontWeight: 600 };
const controlRowStyle: CSSProperties = { display: "flex", gap: 10 };
const primaryBtnStyle: CSSProperties = { flex: 1, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const secondaryBtnStyle: CSSProperties = { flex: 1, background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer" };
const resultCardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 };
const resultTitleStyle: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" };
const resultBestStyle: CSSProperties = { borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 16 };
const thresholdRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const thresholdChipStyle: CSSProperties = { fontSize: 11, fontWeight: 600, color: "#94a3b8", background: "#1e293b", borderRadius: 20, padding: "3px 9px" };
const ctaLinkStyle: CSSProperties = { background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" };
const disclaimerStyle: CSSProperties = { margin: 0, fontSize: 11, color: "#475569", textAlign: "center" };
