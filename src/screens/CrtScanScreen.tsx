import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCrtScan } from "../hooks/useCrtScan";
import { classifyCrt } from "../lib/crtEngine";
import type { CrtScanPhase } from "../hooks/useCrtScan";

// ── Phase helpers ─────────────────────────────────────────────────────────────

function phaseInstruction(phase: CrtScanPhase, crtPhase: string): string {
  switch (phase) {
    case "idle":
      return "Initialising camera…";
    case "align":
      return "Place your fingernail in the nail box. Tap 'Ready' when aligned.";
    case "baseline":
      return "Hold still — calibrating baseline skin tone…";
    case "press":
      return "Press thumbnail firmly for 5 seconds until blanched, then release.";
    case "measuring":
      if (crtPhase === "pressed") return "Nail pressed — keep pressing…";
      if (crtPhase === "released") return "Release detected — measuring colour refill…";
      return "Measuring capillary recovery…";
    case "complete":
      return "Test complete!";
    case "failed":
      return "Unable to detect clear refill — please retry.";
  }
}

function classConfig(sec: number): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  emoji: string;
} {
  const c = classifyCrt(sec);
  switch (c) {
    case "normal":
      return {
        label: "Normal (< 2 s)",
        bgClass: "bg-emerald-500/10",
        textClass: "text-emerald-800 dark:text-emerald-400",
        borderClass: "border-emerald-500/30",
        emoji: "✅",
      };
    case "borderline":
      return {
        label: "Borderline (2–3 s)",
        bgClass: "bg-amber-500/10",
        textClass: "text-amber-800 dark:text-amber-400",
        borderClass: "border-amber-500/30",
        emoji: "⚠️",
      };
    case "slow":
      return {
        label: "Prolonged (≥ 3 s) — Refer",
        bgClass: "bg-red-500/10",
        textClass: "text-red-700 dark:text-red-400",
        borderClass: "border-red-500/30",
        emoji: "🚨",
      };
  }
}

export function CrtScanScreen() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useCrtScan({ videoRef, waveCanvasRef });

  const { phase, permission, crtPhase, result, failureReason } = state;
  const denied = permission === "denied" || permission === "unsupported";
  const crtClass = result?.crtSec != null ? classConfig(result.crtSec) : null;

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/fusion" }}
        title="Capillary Refill"
        subtitle="Bedside CRT Screen"
      />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-4 text-ink">
        <p className="text-xs text-muted leading-relaxed">
          Capillary Refill Time (CRT) evaluates peripheral perfusion and shock. A refill time &gt; 2 seconds can indicate circulatory compromise.
        </p>

        {/* Camera denied */}
        {denied && (
          <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm font-bold text-red-600">📷 Camera access blocked</p>
            <p className="text-xs text-red-700 mt-1">
              Please allow camera access in your browser to perform the capillary refill test.
            </p>
          </div>
        )}

        {/* Video viewfinder */}
        <div className="relative aspect-[4/3] w-full rounded-[20px] bg-black overflow-hidden shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {/* ROI Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-[30%] top-[20%] w-[20%] h-[60%] border-2 border-emerald-400 rounded-[8px] flex items-end justify-center">
              <span className="text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded mb-1">
                Nail
              </span>
            </div>
            <div className="absolute left-[55%] top-[20%] w-[20%] h-[60%] border-2 border-slate-300 rounded-[8px] flex items-end justify-center">
              <span className="text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded mb-1">
                Skin
              </span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Step Instruction
          </p>
          <p className="text-sm font-medium text-ink leading-relaxed">
            {phaseInstruction(phase, crtPhase)}
          </p>
        </div>

        {/* Waveform Canvas */}
        <div className="relative rounded-[16px] border border-line bg-paper overflow-hidden p-1 shadow-inner">
          <canvas ref={waveCanvasRef} width={600} height={100} className="w-full h-auto block" />
          <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-muted">
            Refill curve (ΔG/R)
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2">
          {phase === "align" && (
            <Button
              id="btn-crt-ready"
              variant="default"
              onClick={() => actions.startBaseline()}
              className="w-full text-xs font-semibold"
            >
              ✅ Nail Aligned — Ready
            </Button>
          )}
          {(phase === "complete" || phase === "failed" || denied) && (
            <Button
              id="btn-crt-retry"
              variant="secondary"
              onClick={() => actions.reset()}
              className="w-full text-xs font-semibold"
            >
              🔄 Retry CRT Test
            </Button>
          )}
        </div>

        {/* Results */}
        {phase === "complete" && result?.crtSec != null && crtClass && (
          <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              CRT Test Result
            </h2>
            <div
              className={`flex items-center gap-3.5 rounded-[16px] p-3.5 border ${crtClass.bgClass} ${crtClass.borderClass} ${crtClass.textClass}`}
            >
              <span className="text-3xl leading-none">{crtClass.emoji}</span>
              <div>
                <p className="font-display text-base font-bold leading-tight">{crtClass.label}</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Recovery Time: <span className="font-bold">{result.crtSec.toFixed(1)} s</span> · Quality: {result.quality}
                </p>
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                &lt; 2.0 s Normal
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 border border-amber-500/20">
                2.0–3.0 s Borderline
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-800 border border-red-500/20">
                &gt; 3.0 s Prolonged
              </span>
            </div>

            <Link to="/fusion" className="w-full">
              <Button variant="default" className="w-full text-xs font-semibold">
                View Triage Summary →
              </Button>
            </Link>
          </div>
        )}

        {phase === "failed" && (
          <div className="rounded-[16px] border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800">
            {failureReason ?? "Color recovery curve could not be clearly resolved. Please ensure steady lighting and retry."}
          </div>
        )}

        <p className="text-[11px] text-muted text-center leading-relaxed">
          Not a medical device. For screening only.
        </p>
      </main>
    </AppFrame>
  );
}
