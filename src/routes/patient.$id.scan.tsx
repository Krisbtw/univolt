import { Link, createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect, type CSSProperties } from "react";
import {
  Camera,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Flashlight,
  Activity,
  Fingerprint,
} from "lucide-react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { SavedLocalBadge } from "@/components/sync-indicator";
import { WaveformCanvas } from "@/components/waveform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLiveCameraPpg } from "@/hooks/useLiveCameraPpg";
import { selectPatient, useUnivolt } from "@/lib/univolt/store";
import { PPG_DURATION_SEC } from "@/lib/univolt/ppgProcessor";

export const Route = createFileRoute("/patient/$id/scan")({ component: VitalsScanScreen });

export function VitalsScanScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const addVitalsScan = useUnivolt((s) => s.addVitalsScan);
  const patient = selectPatient(db, id);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { state, samplesRef, actions } = useLiveCameraPpg({ videoRef });
  const [saved, setSaved] = useState(false);

  // Auto-save when scan completes.
  useEffect(() => {
    if (state.phase === "done" && state.result && patient && !saved) {
      addVitalsScan(patient.id, state.result, state.mode === "demo");
      setSaved(true);
    }
  }, [state.phase, state.result, state.mode, patient, saved, addVitalsScan]);

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
      </AppFrame>
    );
  }

  const { mode, phase, remaining, isContact, torchActive, error, result, liveBpm, rMean, dominance } = state;

  const isScanning = phase === "running" || phase === "paused" || phase === "starting";
  const isStarting = phase === "starting";
  const isRunning = phase === "running";
  const isPaused = phase === "paused";

  // Progress 0–100 derived from elapsed active milliseconds.
  const elapsedSec = PPG_DURATION_SEC - remaining;
  const progressPct = Math.min(100, (elapsedSec / PPG_DURATION_SEC) * 100);

  // Signal strength 0–100 from red dominance (contact gate metrics).
  const signalStrength = isContact
    ? Math.min(100, Math.round(((dominance - 1.4) / 1.6) * 100))
    : 0;

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/patient/$id", params: { id: patient.id } }}
        title="Vitals scan"
        subtitle={patient.name}
      />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">

        {/* ── PPG Monitor & Viewfinder ── */}
        <div className="relative overflow-hidden rounded-[24px] bg-monitor p-3 text-paper shadow-inner">

          {/* Monitor Header */}
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-trace/80">
                {mode === "live" ? "Live Optical PPG" : mode === "demo" ? "Demo signal" : "PPG monitor"}
              </p>

              {/* Contact status pill */}
              {mode === "live" && isScanning && !isStarting ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    isContact
                      ? "bg-pine text-pine-fg animate-pulse"
                      : "bg-warn/30 text-amber-200"
                  }`}
                >
                  {isContact ? "Contact active" : isPaused ? "Paused" : "Waiting"}
                </span>
              ) : null}

              {/* Torch badge */}
              {torchActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  <Flashlight className="size-3" />
                  Flash on
                </span>
              ) : null}
            </div>

            {/* Countdown / live BPM */}
            <div className="flex items-center gap-2">
              {isScanning && liveBpm !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-pine/20 px-2 py-0.5 text-[11px] font-semibold text-pine-fg">
                  <Activity className="size-3" />
                  {liveBpm} bpm
                </span>
              ) : null}
              {isScanning ? (
                <span className="font-display text-2xl tabular-nums text-paper">{remaining}s</span>
              ) : (
                <span className="text-[11px] text-trace/70">{PPG_DURATION_SEC}s capture</span>
              )}
            </div>
          </div>

          {/* Camera Viewfinder */}
          <div className="relative h-44 w-full overflow-hidden rounded-[16px] bg-black">
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                mode === "live" && isScanning ? "opacity-70" : "opacity-0 pointer-events-none"
              }`}
              autoPlay
              playsInline
              muted
            />

            {/* Waveform Oscilloscope Overlay */}
            <div className="absolute inset-0 z-10">
              <WaveformCanvas
                samplesRef={samplesRef}
                className="h-full w-full"
                color={mode === "demo" ? "#818cf8" : isContact ? "#9ee0c2" : "#f59e0b"}
              />
            </div>

            {/* Live Contact & Alignment Gate Overlay */}
            {mode === "live" && isScanning ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-3 bg-gradient-to-t from-black/80 via-transparent to-black/50">

                {/* Top instruction banner */}
                <div
                  className={`rounded-full border px-3 py-1.5 text-center backdrop-blur-sm transition-colors ${
                    isContact
                      ? "border-pine/40 bg-black/60"
                      : "border-white/20 bg-black/60"
                  }`}
                >
                  <p className="text-xs font-semibold text-white leading-tight">
                    {isStarting
                      ? "Place fingertip firmly over the rear camera lens and flash"
                      : isContact
                      ? "Place fingertip firmly over the rear camera lens and flash"
                      : "Contact lost — cover lens to resume"}
                  </p>
                </div>

                {/* Lens target guide (circular crosshair) */}
                <div
                  style={lensGuideStyle(isContact)}
                  className="transition-all duration-300"
                >
                  <Fingerprint
                    className={`size-8 transition-colors ${
                      isContact ? "text-pine-fg" : "text-white/40"
                    }`}
                  />
                </div>

                {/* Bottom status banner */}
                {!isContact ? (
                  <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-950/80 px-3 py-2 text-center text-xs text-amber-200 backdrop-blur-md">
                    <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                    <span>
                      {isStarting
                        ? "Waiting for finger contact…"
                        : "Contact lost — cover lens to resume"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-xl border border-pine/40 bg-black/60 px-3 py-1.5 text-xs text-trace backdrop-blur-md">
                    <CheckCircle2 className="size-3.5 text-pine-fg" />
                    <span>Optical pulse stream locked</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Demo mode overlay */}
            {mode === "demo" && isScanning ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <span className="rounded-full border border-indigo-400/30 bg-indigo-950/70 px-3 py-1.5 text-[11px] font-semibold text-indigo-300 backdrop-blur-sm">
                  Simulated fingertip PPG — demo signal
                </span>
              </div>
            ) : null}
          </div>

          {/* Progress Bar */}
          {isScanning ? (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all duration-200 ${
                  mode === "demo"
                    ? "bg-indigo-400"
                    : isContact
                    ? "bg-pine-fg"
                    : "bg-amber-400"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : null}

          {/* Signal strength meter (live mode only) */}
          {mode === "live" && (isRunning || isPaused) ? (
            <div className="mt-2 flex items-center gap-2 px-1">
              <span className="text-[10px] text-trace/60 w-14 shrink-0">Signal</span>
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    signalStrength > 60
                      ? "bg-pine-fg"
                      : signalStrength > 30
                      ? "bg-amber-400"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${signalStrength}%` }}
                />
              </div>
              <span className="text-[10px] text-trace/60 w-6 text-right tabular-nums">
                {signalStrength}%
              </span>
            </div>
          ) : null}

          <p className="mt-2 px-1 text-[11px] text-trace/75">
            {mode === "live"
              ? "Live optical sensor mode · red-channel capillary microvascular absorption"
              : mode === "demo"
              ? "Simulated morphologically-accurate fingertip PPG (for web preview)"
              : "Zero-hardware vitals extraction"}
          </p>
        </div>

        {/* ── Error / Permission notice ── */}
        {error ? (
          <div className="rounded-[18px] border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold">Camera Notice</p>
            <p className="mt-1 text-xs">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-red-500/30 text-red-300 hover:text-red-100"
              onClick={actions.resetScan}
            >
              Dismiss
            </Button>
          </div>
        ) : null}

        {/* ── Instructions (idle state) ── */}
        {!result && phase === "idle" ? (
          <div className="rounded-[20px] border border-line bg-paper p-4 text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">Zero-Hardware Vitals Extraction</p>
            <p className="mt-1">
              On <strong className="text-ink">mobile phones</strong>, Live Camera Mode
              targets the rear camera and engages the LED flashlight to measure arterial
              pulsation through the fingertip — no external hardware required.
            </p>
            <p className="mt-2 text-xs text-faint">
              On laptops or devices without rear flash, use{" "}
              <strong className="text-ink/60">Run Demo Signal</strong> to test the
              on-device bandpass + peak-detection pipeline.
            </p>
          </div>
        ) : null}

        {/* ── Action Controls ── */}
        {phase === "idle" ? (
          <div className="flex flex-col gap-2.5">
            {/* PRIMARY: Live Camera Scan */}
            <Button
              id="btn-start-live"
              size="lg"
              onClick={actions.startLiveScan}
              className="w-full gap-2"
            >
              <Camera className="size-4" />
              Start Live Camera Scan
            </Button>

            {/* SECONDARY: Demo Signal (always visible for laptop judges) */}
            <Button
              id="btn-start-demo"
              variant="outline"
              size="lg"
              onClick={actions.startDemoScan}
              className="w-full gap-2 border-line text-muted hover:text-ink"
            >
              <Sparkles className="size-4" />
              Run 12s demo signal&nbsp;
              <span className="text-[11px] opacity-60">(laptop preview)</span>
            </Button>
          </div>
        ) : isScanning ? (
          <div className="flex gap-2">
            <Button
              id="btn-cancel-scan"
              variant="danger"
              size="lg"
              onClick={actions.resetScan}
              className="flex-1 gap-2"
            >
              <RotateCcw className="size-4" />
              Cancel Scan
            </Button>
          </div>
        ) : phase === "processing" ? (
          <Button id="btn-processing" size="lg" disabled className="w-full">
            Filtering signal &amp; detecting peaks…
          </Button>
        ) : null}

        {/* ── Diagnostic Results Card ── */}
        {result && phase === "done" ? (
          <section className="rounded-[24px] border border-line bg-paper p-4 shadow-sm animate-in fade-in duration-300">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">Scan result</h2>
                <p className="text-[11px] text-muted">
                  {mode === "live" ? "Live Physical Fingertip PPG" : "Validated Simulated Signal"}
                </p>
              </div>
              {saved ? <SavedLocalBadge /> : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Heart rate" value={`${result.heartRate}`} unit="bpm" highlight />
              <Metric label="HRV (RMSSD)" value={`${result.hrvRmssd}`} unit="ms" />
              <Metric label="Respiratory rate" value={`${result.respiratoryRate}`} unit="/min" />
              <Metric label="Est. SpO₂" value={`${result.spo2Estimate}`} unit="%" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="muted">Signal quality {result.signalQuality}%</Badge>
              <Badge variant="monitor">{result.peakCount} peaks detected</Badge>
              {mode === "live" ? (
                <Badge className="bg-pine text-pine-fg">Live hardware capture</Badge>
              ) : (
                <Badge className="bg-indigo-900 text-indigo-200">Simulated signal</Badge>
              )}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Processed on-device using bandpass filtering (0.7–3.0 Hz) and adaptive peak
              detection. Scan data cached to local SQLite for offline access.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Button asChild className="w-full" size="lg">
                <Link to="/patient/$id" params={{ id: patient.id }}>
                  Back to record
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSaved(false);
                  actions.resetScan();
                }}
                className="w-full"
              >
                Scan again
              </Button>
            </div>
          </section>
        ) : null}
      </main>
    </AppFrame>
  );
}

// ── Lens guide style (inline for dynamic values) ────────────────────────────
function lensGuideStyle(contact: boolean): CSSProperties {
  return {
    width: 64,
    height: 64,
    borderRadius: "50%",
    border: `2px solid ${contact ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.25)"}`,
    boxShadow: contact
      ? "0 0 0 8px rgba(52,211,153,0.12), 0 0 24px rgba(52,211,153,0.3)"
      : "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
  };
}

// ── Metric tile ─────────────────────────────────────────────────────────────
function Metric({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-[16px] bg-surface px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p
        className={`mt-0.5 font-display text-[1.45rem] font-semibold tabular-nums tracking-[-0.03em] ${
          highlight ? "text-pine-fg" : "text-ink"
        }`}
      >
        {value}
        <span className="ml-1 font-sans text-[11px] font-medium text-faint">{unit}</span>
      </p>
    </div>
  );
}
