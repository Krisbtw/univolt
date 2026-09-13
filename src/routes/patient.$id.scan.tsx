import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Activity,
  VideoOff,
  Loader2,
} from "lucide-react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { SavedLocalBadge } from "@/components/sync-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SCAN_DURATION_MS, useRppgScan, type Status } from "@/hooks/useRppgScan";
import { selectPatient, useUnivolt } from "@/lib/univolt/store";
import { getStrings } from "@/lib/translations";
import { loadLocale } from "@/lib/vitalsDatabase";

export const Route = createFileRoute("/patient/$id/scan")({ component: VitalsScanScreen });

const SCAN_DURATION_SEC = Math.round(SCAN_DURATION_MS / 1000);

const STATUS_TEXT: Record<Status, string | null> = {
  ok: null,
  loading_model: "Loading face model…",
  model_fallback: "Model unavailable — using skin-tone fallback",
  no_face: "No face detected",
  motion: "Hold still",
  low_light: "Low light — face a light source",
  weak_signal: "Weak signal — hold still and stay lit",
};

export function VitalsScanScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const addVitalsScan = useUnivolt((s) => s.addVitalsScan);
  const patient = selectPatient(db, id);
  const t = getStrings(loadLocale() ?? "en");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ppgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useRppgScan({ videoRef, ppgCanvasRef });
  const [saved, setSaved] = useState(false);

  // Auto-save when a scan completes with a real reading — never persist a
  // rejected / null-BPM scan (that would fabricate a number for the record).
  useEffect(() => {
    if (state.phase !== "complete" || state.result === null || !patient || saved) return;
    const result = state.result;
    if (result.bpm === null) return;
    addVitalsScan(
      patient.id,
      {
        heartRate: result.bpm,
        hrvRmssd: result.hrv ?? 0,
        signalQuality: Math.round(result.confidence * 100),
        respiratoryRate: result.rr ?? 0,
         spo2Estimate: null, // face rPPG cannot measure SpO₂ — never fake it
        peakCount: result.peakCount,
        durationSec: SCAN_DURATION_SEC,
        sampleRate: 30,
      },
      false,
    );
    setSaved(true);
  }, [state.phase, state.result, patient, saved, addVitalsScan]);

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
      </AppFrame>
    );
  }

  const { phase, permission, status, progressMs, liveBpm, result } = state;
  const isPositioning = phase === "positioning";
  const isMeasuring = phase === "measuring";
  const isComplete = phase === "complete";
  const cameraGranted = permission === "granted";
  const showPermissionFallback =
    (permission === "denied" || permission === "unsupported") &&
    (phase === "idle" || phase === "positioning");

  const remainingSec = Math.max(0, Math.ceil((SCAN_DURATION_MS - progressMs) / 1000));
  const progressPct = Math.min(100, (progressMs / SCAN_DURATION_MS) * 100);
  const detected = isComplete && result !== null && result.bpm !== null;
  const statusText = STATUS_TEXT[status];

  function handleReset(): void {
    setSaved(false);
    actions.reset();
  }

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/patient/$id", params: { id: patient.id } }}
        title="Vitals scan"
        subtitle={patient.name}
      />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">
        {/* ── Face rPPG viewfinder ── */}
        <div className="relative overflow-hidden rounded-[24px] bg-monitor p-3 text-paper shadow-inner">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-trace/80">
                Face rPPG
              </p>
              {status === "loading_model" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-trace">
                  <Loader2 className="size-3 animate-spin" />
                  Loading model
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isMeasuring && liveBpm !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-pine/20 px-2 py-0.5 text-[11px] font-semibold text-pine-fg">
                  <Activity className="size-3" />
                  {liveBpm} bpm
                </span>
              ) : null}
              {isMeasuring ? (
                <span className="font-display text-2xl tabular-nums text-paper">
                  {remainingSec}s
                </span>
              ) : (
                <span className="text-[11px] text-trace/70">{SCAN_DURATION_SEC}s capture</span>
              )}
            </div>
          </div>

          {/* Camera viewfinder — mirrored front camera, no torch, no finger contact */}
          <div className="relative h-56 w-full overflow-hidden rounded-[16px] bg-black">
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                cameraGranted ? "opacity-90 [transform:scaleX(-1)]" : "opacity-0 pointer-events-none"
              }`}
              autoPlay
              playsInline
              muted
            />

            {/* PPG waveform overlay — drawn directly by the hook onto this canvas */}
            <canvas ref={ppgCanvasRef} className="absolute inset-0 z-10 h-full w-full opacity-80" />

            {cameraGranted && (isPositioning || isMeasuring) ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-3 bg-gradient-to-t from-black/80 via-transparent to-black/40">
                {/* Top instruction banner */}
                <div className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-center backdrop-blur-sm">
                  <p className="text-xs font-semibold text-white leading-tight">
                    {isPositioning ? "Center your face in the oval" : "Hold still…"}
                  </p>
                </div>

                {/* Oval face guide */}
                <div style={ovalGuideStyle(status === "ok" || isMeasuring)} />

                {/* Bottom status banner */}
                {statusText !== null ? (
                  <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-950/80 px-3 py-2 text-center text-xs text-amber-200 backdrop-blur-md">
                    <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                    <span>{statusText}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-xl border border-pine/40 bg-black/60 px-3 py-1.5 text-xs text-trace backdrop-blur-md">
                    <CheckCircle2 className="size-3.5 text-pine-fg" />
                    <span>{isMeasuring ? "Signal locked" : "Face detected"}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Progress bar */}
          {isMeasuring ? (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-pine-fg transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : null}

          <p className="mt-2 px-1 text-[11px] text-trace/75">
            Front-camera remote PPG · CHROM chrominance over forehead &amp; cheeks — no
            flashlight, no finger contact required
          </p>
        </div>

        {/* ── Camera denied / unsupported fallback ── */}
        {showPermissionFallback ? (
          <div className="rounded-[20px] border border-line bg-paper p-4 text-sm leading-relaxed text-muted">
            <div className="mb-2 flex items-center gap-2 text-ink">
              <VideoOff className="size-4" />
              <p className="font-semibold">
                {permission === "unsupported" ? "Camera not supported" : "Camera access needed"}
              </p>
            </div>
            <p>
              {permission === "unsupported"
                ? "This browser doesn't support camera capture, so a face scan isn't possible here."
                : "Grant camera access to measure vitals from your face — no external hardware required."}
            </p>
            {permission !== "unsupported" ? (
              <Button size="lg" className="mt-3 w-full" onClick={actions.requestCamera}>
                Grant camera permission
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* ── Instructions (before the camera comes up) ── */}
        {!showPermissionFallback && phase === "idle" ? (
          <div className="rounded-[20px] border border-line bg-paper p-4 text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">Zero-Hardware Vitals Extraction</p>
            <p className="mt-1">
              Center your <strong className="text-ink">face</strong> in the oval and hold still —
              the scan starts automatically and measures heart rate from subtle color changes in
              your skin, no fingertip contact needed.
            </p>
          </div>
        ) : null}

        {/* ── Cancel (mid-scan) ── */}
        {isMeasuring ? (
          <Button variant="danger" size="lg" onClick={handleReset} className="w-full gap-2">
            <RotateCcw className="size-4" />
            Cancel scan
          </Button>
        ) : null}

        {/* ── Result card ── */}
        {isComplete && result ? (
          <section className="rounded-[24px] border border-line bg-paper p-4 shadow-sm animate-in fade-in duration-300">
            {detected ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">Scan result</h2>
                    <p className="text-[11px] text-muted">Live face rPPG</p>
                  </div>
                  {saved ? <SavedLocalBadge /> : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Heart rate" value={`${result.bpm}`} unit="bpm" highlight />
                  <Metric label="HRV (SDNN)" value={`${result.hrv ?? "--"}`} unit="ms" />
                  <Metric label="Respiratory rate" value={`${result.rr ?? "--"}`} unit="/min" />
                  <Metric label="SpO₂" value="--" unit="not measured" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="muted">
                    {result.quality === "good" ? "Good" : "Weak"} signal · {result.snrDb.toFixed(1)}{" "}
                    dB
                  </Badge>
                  <Badge variant="monitor">{result.peakCount} peaks detected</Badge>
                  <Badge className="bg-pine text-pine-fg">Live face capture</Badge>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-faint">
                  Processed on-device: CHROM chrominance, bandpass filtering (0.7–3.0 Hz), and
                  spectral + peak-detection agreement. Scan data cached to local storage for
                  offline access.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-ink">Unable to detect</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  The signal was too noisy to measure a heart rate. Sit still, face a steady light
                  source, and try again for the full {SCAN_DURATION_SEC} seconds.
                </p>
              </>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {detected ? (
                <Button asChild variant="secondary" size="lg" className="w-full">
                  <Link to="/patient/$id/spo2" params={{ id: patient.id }}>
                    {t.spo2AddButton}
                  </Link>
                </Button>
              ) : null}
              {detected ? (
                <Button asChild className="w-full" size="lg">
                  <Link to="/patient/$id" params={{ id: patient.id }}>
                    Back to record
                  </Link>
                </Button>
              ) : null}
              <Button
                variant={detected ? "outline" : "default"}
                size="lg"
                onClick={handleReset}
                className="w-full gap-2"
              >
                <RotateCcw className="size-4" />
                New scan
              </Button>
            </div>
          </section>
        ) : null}
      </main>
    </AppFrame>
  );
}

// ── Oval face guide style (inline for dynamic values) ───────────────────────
function ovalGuideStyle(locked: boolean): CSSProperties {
  return {
    width: 108,
    height: 140,
    borderRadius: "50%",
    border: `2px dashed ${locked ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.35)"}`,
    boxShadow: locked ? "0 0 0 8px rgba(52,211,153,0.10), 0 0 24px rgba(52,211,153,0.25)" : "none",
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
          highlight ? "text-pine" : "text-ink"
        }`}
      >
        {value}
        <span className="ml-1 font-sans text-[11px] font-medium text-faint">{unit}</span>
      </p>
    </div>
  );
}
