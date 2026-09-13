import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useFetTest } from "../hooks/useFetTest";
import { classifyFet, type FetClassification } from "../lib/breathAudioEngine";
import type { FetPhase } from "../hooks/useFetTest";

// ── Classification display ────────────────────────────────────────────────────

function classConfig(c: FetClassification): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  emoji: string;
} {
  switch (c) {
    case "normal":
      return {
        label: "Normal (< 4 s)",
        bgClass: "bg-emerald-500/10",
        textClass: "text-emerald-800 dark:text-emerald-400",
        borderClass: "border-emerald-500/30",
        emoji: "✅",
      };
    case "borderline":
      return {
        label: "Borderline (4–6 s)",
        bgClass: "bg-amber-500/10",
        textClass: "text-amber-800 dark:text-amber-400",
        borderClass: "border-amber-500/30",
        emoji: "⚠️",
      };
    case "obstruction":
      return {
        label: "Possible obstruction (> 6 s)",
        bgClass: "bg-red-500/10",
        textClass: "text-red-700 dark:text-red-400",
        borderClass: "border-red-500/30",
        emoji: "🚨",
      };
    case "reject":
      return {
        label: "Unable to detect",
        bgClass: "bg-surface",
        textClass: "text-muted",
        borderClass: "border-line",
        emoji: "❌",
      };
  }
}

function phaseLabel(phase: FetPhase): string {
  switch (phase) {
    case "idle":
      return "Ready to start";
    case "calibrating":
      return "Calibrating microphone…";
    case "instruction":
      return "Take a deep breath, then blow all the air out!";
    case "recording":
      return "Recording — keep blowing!";
    case "between":
      return "Trial 1 done. Preparing trial 2…";
    case "done":
      return "Test complete";
  }
}

export function FetTestScreen() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useFetTest({ canvasRef });

  const { phase, permission, trial, liveSec, result } = state;
  const denied = permission === "denied" || permission === "unsupported";
  const bestClass = result?.bestSec != null ? classifyFet(result.bestSec) : null;

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/fusion" }}
        title="Breathing Test"
        subtitle="Forced Expiratory Time (FET)"
      />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-4 text-ink">
        <p className="text-xs text-muted leading-relaxed">
          Forced Expiratory Time (FET) is a WHO-endorsed bedside screening tool for airway obstruction.
        </p>

        {/* Mic denied */}
        {denied && (
          <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm font-bold text-red-600">🎤 Microphone access blocked</p>
            <p className="text-xs text-red-700 mt-1">
              This test needs microphone access to measure your breathing time. Please enable the microphone in your browser settings and try again.
            </p>
          </div>
        )}

        {/* Instruction */}
        {(phase === "idle" || phase === "instruction" || phase === "calibrating") && (
          <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-2">
            <p className="text-sm font-medium text-ink leading-relaxed italic">
              "Take the deepest breath you can, then blow ALL the air out through your open mouth until your lungs feel completely empty."
            </p>
            <p className="text-xs text-muted">{phaseLabel(phase)}</p>
          </div>
        )}

        {/* Status & live timer */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="rounded-full bg-pine/10 border border-pine/30 px-3 py-1 text-xs font-semibold text-pine">
            {phaseLabel(phase)}
          </span>
          {phase === "recording" && (
            <span className="font-display text-2xl font-bold tabular-nums text-pine">
              {liveSec.toFixed(1)} s
            </span>
          )}
          {result != null && phase !== "done" && (
            <span className="text-xs text-muted font-medium">Trial {trial + 1} / 2</span>
          )}
        </div>

        {/* Canvas envelope */}
        <div className="relative rounded-[16px] border border-line bg-paper overflow-hidden shadow-inner">
          <canvas ref={canvasRef} width={600} height={120} className="w-full h-auto block" />
          {phase === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted pointer-events-none">
              Breathing envelope waveform will appear here
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {phase === "idle" && (
            <Button
              id="btn-fet-start"
              variant="default"
              onClick={() => actions.startTest()}
              className="w-full text-xs font-semibold"
            >
              🎤 Start Breathing Test
            </Button>
          )}
          {phase === "instruction" && (
            <Button
              id="btn-fet-force"
              variant="default"
              onClick={() => actions.forceStart()}
              className="w-full text-xs font-semibold"
            >
              ▶ Start Blowing Now
            </Button>
          )}
          {(phase === "done" || denied) && (
            <Button
              id="btn-fet-retry"
              variant="secondary"
              onClick={() => actions.reset()}
              className="w-full text-xs font-semibold"
            >
              🔄 Retry Test
            </Button>
          )}
        </div>

        {/* Result */}
        {result != null && (
          <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              Test Results
            </h2>
            <div className="flex gap-2">
              {result.trialSecs.map((s, i) => {
                const c = classifyFet(s);
                const cl = classConfig(c);
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-[14px] border ${cl.borderClass} ${cl.bgClass} p-3 flex flex-col gap-0.5`}
                  >
                    <span className="text-[10px] font-bold text-muted uppercase">
                      Trial {i + 1}
                    </span>
                    <span className={`text-base font-bold ${cl.textClass}`}>{s.toFixed(1)} s</span>
                    <span className={`text-[10px] font-medium ${cl.textClass}`}>
                      {cl.emoji} {c}
                    </span>
                  </div>
                );
              })}
            </div>

            {result.bestSec != null && bestClass != null ? (
              (() => {
                const cl = classConfig(bestClass);
                return (
                  <div
                    className={`flex items-center gap-3.5 rounded-[16px] p-3.5 border ${cl.bgClass} ${cl.borderClass} ${cl.textClass}`}
                  >
                    <span className="text-2xl">{cl.emoji}</span>
                    <div>
                      <p className="font-display text-sm font-bold">{cl.label}</p>
                      <p className="text-xs opacity-80 mt-0.5">
                        Best: {result.bestSec.toFixed(1)} s · Quality: {result.quality}
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-muted">
                Unable to detect a valid exhalation. Please retry.
              </p>
            )}

            <Link to="/fusion" className="w-full">
              <Button variant="default" className="w-full text-xs font-semibold">
                View Triage Summary →
              </Button>
            </Link>
          </div>
        )}

        <p className="text-[11px] text-muted text-center leading-relaxed">
          Not a medical device. For screening and education only.
        </p>
      </main>
    </AppFrame>
  );
}
