import { SpeakerButton } from "@/components/communication/speaker-button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCAN_DURATION_MS, useRppgScan, type DebugInfo, type Status } from "../hooks/useRppgScan";
import { evaluateTriage, type TriageResult } from "../lib/triage";
import { getStrings, type Locale, type Strings } from "../lib/translations";
import { useFusionSession } from "../lib/fusionStore";
import { Link } from "@tanstack/react-router";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  clearScans,
  loadLocale,
  loadScans,
  makeId,
  saveLocale,
  saveScan,
  type ScanRecord,
} from "../lib/vitalsDatabase";
import {
  Heart,
  Activity,
  Wind,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Play,
  Camera,
  FileEdit,
  Trash2,
} from "lucide-react";

export function VitalsScanScreen() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ppgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useRppgScan({ videoRef, ppgCanvasRef });

  const [locale, setLocale] = useState<Locale>(() => loadLocale() ?? "en");
  const t: Strings = useMemo(() => getStrings(locale), [locale]);
  useEffect(() => {
    saveLocale(locale);
  }, [locale]);

  const triage: TriageResult | null = useMemo(
    () => (state.result === null ? null : evaluateTriage(state.result)),
    [state.result],
  );

  // Debug HUD — toggled by ?debug=1 in the URL, never visible in normal demo
  const [debugEnabled] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1";
    } catch {
      return false;
    }
  });

  const setRppg = useFusionSession((s) => s.setRppg);

  const [history, setHistory] = useState<ScanRecord[]>(() => loadScans());
  const savedScanIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const result = state.result;
    if (result === null || triage === null) return;
    if (savedScanIdsRef.current.has(result.scanId)) return;
    savedScanIdsRef.current.add(result.scanId);
    saveScan({
      id: result.scanId,
      timestamp: result.timestamp,
      mode: "live",
      bpm: result.bpm,
      hrv: result.hrv,
      spo2: null,
      rr: result.rr,
      locale,
      triageLevel: triage.level,
    });
    try {
      window.localStorage.setItem("univolt.last.face.scan.id", result.scanId);
    } catch {
      // The scan remains usable even when local storage is unavailable.
    }
    // Feed rPPG result into the fusion session store
    setRppg({ bpm: result.bpm, rr: result.rr, hrv: result.hrv, quality: result.quality });
    setHistory(loadScans());
  }, [state.result, triage, locale, setRppg]);

  // Manual entry state
  const [showManual, setShowManual] = useState(false);

  const handleManualSave = useCallback(
    (bpm: number, spo2: number, rr: number): void => {
      const triage = evaluateTriage({ bpm, hrv: null, spo2, rr });
      const record: ScanRecord = {
        id: makeId(),
        timestamp: Date.now(),
        mode: "manual",
        bpm,
        hrv: null,
        spo2,
        rr,
        locale,
        triageLevel: triage.level,
      };
      saveScan(record);
      setHistory(loadScans());
      setShowManual(false);
    },
    [locale],
  );

  const handleClearHistory = useCallback((): void => {
    clearScans();
    setHistory([]);
  }, []);

  // ---- derived view state ----
  const measuring = state.phase === "measuring";
  const remainingSec = Math.max(0, Math.ceil((SCAN_DURATION_MS - state.progressMs) / 1000));
  const progressPct = Math.min(100, (state.progressMs / SCAN_DURATION_MS) * 100);
  const cameraGranted = state.permission === "granted";
  const showPermissionFallback =
    (state.permission === "denied" || state.permission === "unsupported") &&
    (state.phase === "idle" || state.phase === "positioning");
  const result = state.result;
  const detected = result !== null && result.bpm !== null;

  const statusText: string | null = (() => {
    switch (state.status) {
      case "loading_model":
        return t.statusLoadingModel;
      case "model_fallback":
        return t.statusModelFallback;
      case "no_face":
        return t.statusNoFace;
      case "motion":
        return t.statusMotion;
      case "low_light":
        return t.statusLowLight;
      case "weak_signal":
        return t.statusWeakSignal;
      default:
        return null;
    }
  })();

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/" }}
        title={t.appTitle}
        subtitle={t.tagline}
      />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-3 text-ink">
        {/* Viewfinder Section */}
        <section className="relative h-64 w-full overflow-hidden rounded-[20px] border border-line bg-black shadow-xs">
          <video
            ref={videoRef}
            className={`h-full w-full object-cover [transform:scaleX(-1)] transition-opacity duration-300 ${
              cameraGranted ? "opacity-90" : "opacity-20"
            }`}
            autoPlay
            playsInline
            muted
          />

          {/* Oval Face Guide */}
          {cameraGranted && (state.phase === "positioning" || measuring) && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-36 rounded-[50%] border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              aria-hidden
            />
          )}

          {/* Viewfinder Overlays & HUD */}
          {(state.phase === "positioning" || measuring) && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-wrap items-center justify-center gap-2 px-3">
              <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm shadow-xs">
                {state.phase === "positioning"
                  ? t.faceGuide
                  : `${t.measuringLabel} · ${remainingSec}${t.secUnit}`}
              </span>
              {statusText !== null && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm shadow-xs ${statusPillClasses(
                    state.status,
                  )}`}
                >
                  {statusText}
                </span>
              )}
            </div>
          )}

          {/* Measuring Progress Bar */}
          {measuring && (
            <div className="absolute bottom-20 left-4 right-4 h-1.5 overflow-hidden rounded-full bg-white/20 backdrop-blur-xs">
              <div
                className="h-full bg-emerald-400 transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* PPG Waveform Canvas */}
          <canvas
            ref={ppgCanvasRef}
            width={600}
            height={140}
            className="absolute bottom-0 left-0 right-0 h-20 w-full bg-black/40 backdrop-blur-xs"
          />

          {/* Debug HUD if ?debug=1 */}
          {debugEnabled && <DebugHud info={state.debug} />}

          {/* Permission Fallback Overlay */}
          {showPermissionFallback && (
            <PermissionFallback
              t={t}
              unsupported={state.permission === "unsupported"}
              onGrant={actions.requestCamera}
            />
          )}
        </section>

        {/* Manual Start Button during Positioning */}
        {state.phase === "positioning" && (
          <Button
            id="btn-manual-start-scan"
            size="lg"
            className="w-full gap-2 rounded-[16px] bg-pine py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-pine/90 disabled:opacity-50"
            disabled={!state.roiActive}
            onClick={actions.startScan}
          >
            <Play className="size-4 fill-current" />
            Start scan
          </Button>
        )}

        {/* Manual Entry Form / Toggle */}
        {(state.phase === "idle" || showPermissionFallback) && !showManual && (
          <Button
            variant="outline"
            className="w-full gap-2 rounded-[16px] border-line bg-paper text-xs font-semibold text-ink shadow-xs hover:bg-surface"
            onClick={() => setShowManual(true)}
          >
            <FileEdit className="size-3.5" />
            Camera unavailable? Enter vitals manually
          </Button>
        )}

        {showManual && (
          <ManualEntryForm
            t={t}
            onSave={handleManualSave}
            onCancel={() => setShowManual(false)}
          />
        )}

        {/* Recorded Vitals Cards (Light Theme matching ReferralSlip) */}
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Recorded Vitals
          </p>
          <div className="grid grid-cols-3 gap-2">
            <VitalTile
              label="HR"
              value={result ? result.bpm : measuring ? state.liveBpm : null}
              unit={t.metricHeartRateUnit}
              icon="❤️"
              placeholder={t.placeholder}
            />
            <VitalTile
              label="HRV"
              value={result ? result.hrv : null}
              unit={t.metricHrvUnit}
              icon="💓"
              placeholder={t.placeholder}
            />
            <VitalTile
              label="RR"
              value={result ? result.rr : null}
              unit={t.metricRespRateUnit}
              icon="🫁"
              placeholder={t.placeholder}
            />
          </div>

          {detected && result && (
            <p className="mt-1 text-center text-xs font-medium text-muted">
              {`${t.qualityLabel}: ${result.quality === "good" ? t.qualityGood : t.qualityWeak} · ${result.snrDb.toFixed(1)} dB`}
            </p>
          )}
        </div>

        {/* Unable to Detect Warning */}
        {state.phase === "complete" && !detected && (
          <div className="rounded-[20px] border border-rose-200 bg-rose-50/80 p-4 shadow-xs">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="size-4.5 shrink-0" />
              <h3 className="text-sm font-bold">{t.unableToDetect}</h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-rose-700">
              {t.unableToDetectBody}
            </p>
          </div>
        )}

        {/* Guidance / Triage Card */}
        {state.phase === "complete" && detected && triage !== null && (
          <GuidanceCard
            t={t}
            triage={triage}
            locale={locale}
            onSetLocale={setLocale}
          />
        )}

        {/* Action Buttons when Complete */}
        {state.phase === "complete" && detected && (
          <Link to="/spo2" className="w-full">
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2 rounded-[16px] border-line bg-paper text-xs font-semibold text-ink shadow-xs hover:bg-surface"
            >
              🩸 {t.spo2AddButton}
            </Button>
          </Link>
        )}

        {state.phase === "complete" && (
          <Button
            size="lg"
            className="w-full gap-2 rounded-[16px] bg-pine text-white shadow-xs hover:bg-pine/90"
            onClick={actions.reset}
          >
            <RotateCcw className="size-4" />
            {t.newScanButton}
          </Button>
        )}

        {/* Scan History */}
        <HistoryList
          history={history}
          t={t}
          onClear={handleClearHistory}
        />

        {/* Disclaimer */}
        <p className="text-[11px] leading-relaxed text-muted text-center mt-1">
          {t.disclaimer}
        </p>
      </main>
    </AppFrame>
  );
}

// ---------- Sub-components ----------

function VitalTile({
  label,
  value,
  unit,
  icon,
  placeholder,
}: {
  label: string;
  value: number | null;
  unit: string;
  icon: string;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-[16px] border border-line bg-surface/80 p-3 shadow-xs">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted">
        <span>{icon}</span> {label}
      </span>
      <span className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
        {value === null ? (
          <span className="text-muted/60">{placeholder}</span>
        ) : (
          Math.round(value)
        )}
        <span className="ml-1 text-xs font-normal text-muted">{unit}</span>
      </span>
    </div>
  );
}

function statusPillClasses(status: Status): string {
  switch (status) {
    case "ok":
      return "border border-emerald-500/30 bg-emerald-950/70 text-emerald-300";
    case "weak_signal":
    case "model_fallback":
      return "border border-amber-500/30 bg-amber-950/70 text-amber-300";
    default:
      return "border border-red-500/30 bg-red-950/70 text-red-300";
  }
}

function GuidanceCard({
  t,
  triage,
  locale,
  onSetLocale,
}: {
  t: Strings;
  triage: TriageResult;
  locale: Locale;
  onSetLocale: (locale: Locale) => void;
}) {
  const branch = t.guidance.triage[triage.level];
  const isUrgent = triage.urgent;
  const isReferral = triage.referral;

  const bannerClass = isUrgent
    ? "border-red-500/30 bg-red-500/10 text-red-800"
    : isReferral
    ? "border-amber-500/30 bg-amber-500/10 text-amber-900"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900";

  function handleSmsShare() {
    const text = `[UniCare Health] ${branch.title}\n${branch.body}`;
    window.open("sms:?body=" + encodeURIComponent(text));
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-paper p-4 shadow-xs">
      {/* Header & Language Switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          {t.guidanceTitle}
        </h3>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              locale === "en"
                ? "bg-pine text-white"
                : "bg-surface text-muted hover:bg-surface/80"
            }`}
            onClick={() => onSetLocale("en")}
          >
            {t.localeNameEn}
          </button>
          <button
            type="button"
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              locale === "hi"
                ? "bg-pine text-white"
                : "bg-surface text-muted hover:bg-surface/80"
            }`}
            onClick={() => onSetLocale("hi")}
          >
            {t.localeNameHi}
          </button>
        </div>
      </div>

      {/* Triage Level Banner */}
      <div className={`rounded-[16px] border p-3.5 ${bannerClass}`}>
        <p className="font-display text-base font-bold leading-tight">
          {branch.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{branch.body}</p>

        {isReferral && (
          <p className="mt-2 text-xs font-semibold">
            {isUrgent ? <strong className="mr-1 text-red-600">{t.guidance.urgentPrefix}</strong> : null}
            {t.guidance.referralLine}
          </p>
        )}
      </div>

      {/* TTS Read Aloud */}
      <SpeakerButton
        text={`${branch.title}. ${branch.body}`}
        locale={locale}
        t={t}
        className="w-full"
      />

      {/* Share via SMS */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 rounded-[12px] border-line bg-surface text-xs font-semibold text-ink hover:bg-surface/80"
        onClick={handleSmsShare}
      >
        <Share2 className="size-3.5" />
        Share via SMS / WhatsApp
      </Button>
    </div>
  );
}

function HistoryList({
  history,
  t,
  onClear,
}: {
  history: ScanRecord[];
  t: Strings;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-paper p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          {t.historyTitle}
        </h3>
        {history.length > 0 && (
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-red-600 transition-colors"
            onClick={onClear}
          >
            <Trash2 className="size-3" />
            {t.clearHistoryButton}
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-muted py-2">{t.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2 pt-1">
          {history.map((record) => (
            <li
              key={record.id}
              className="flex flex-col gap-1 rounded-[14px] border border-line/70 bg-surface/60 p-2.5 text-xs shadow-xs"
            >
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>{formatTimestamp(record.timestamp, record.locale)}</span>
                <span className="rounded-full bg-paper px-2 py-0.5 font-medium border border-line">
                  {record.mode === "manual" ? "✍️ Manual" : "📹 Live"}
                </span>
              </div>
              <p className="font-semibold text-ink">
                {`❤️ HR: ${record.bpm ?? t.placeholder} bpm · 🫁 RR: ${record.rr ?? t.placeholder} /min`}
                {record.spo2 != null ? ` · 🩸 SpO₂: ${record.spo2}%` : ""}
              </p>
              <p className="text-[11px] text-muted">
                {t.guidance.triage[record.triageLevel]?.title}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PermissionFallback({
  t,
  unsupported,
  onGrant,
}: {
  t: Strings;
  unsupported: boolean;
  onGrant: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/85 p-6 text-center text-white backdrop-blur-sm">
      <Camera className="size-8 text-zinc-400" />
      <h3 className="text-sm font-bold">
        {unsupported ? t.permissionUnsupportedTitle : t.permissionDeniedTitle}
      </h3>
      <p className="text-xs text-zinc-300 max-w-xs leading-relaxed">
        {unsupported ? t.permissionUnsupportedBody : t.permissionDeniedBody}
      </p>
      {!unsupported && (
        <Button
          size="sm"
          className="mt-2 bg-pine text-white hover:bg-pine/90 font-semibold"
          onClick={onGrant}
        >
          {t.grantPermissionButton}
        </Button>
      )}
    </div>
  );
}

function ManualEntryForm({
  t,
  onSave,
  onCancel,
}: {
  t: Strings;
  onSave: (bpm: number, spo2: number, rr: number) => void;
  onCancel: () => void;
}) {
  const [bpm, setBpm] = useState("");
  const [spo2, setSpo2] = useState("");
  const [rr, setRr] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const b = parseInt(bpm, 10);
    const s = parseInt(spo2, 10);
    const r = parseInt(rr, 10);
    if (isNaN(b) || b < 30 || b > 220) {
      setError("Heart rate must be 30–220 BPM.");
      return;
    }
    if (isNaN(s) || s < 70 || s > 100) {
      setError("SpO₂ must be 70–100%.");
      return;
    }
    if (isNaN(r) || r < 4 || r > 60) {
      setError("Respiratory rate must be 4–60 /min.");
      return;
    }
    setError(null);
    onSave(b, s, r);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-paper p-4 shadow-xs">
      <h3 className="text-sm font-bold text-ink">✍️ Manual Vitals Entry</h3>
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          ❤️ Heart Rate (BPM)
          <input
            type="number"
            min={30}
            max={220}
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            placeholder="e.g. 75"
            className="rounded-[12px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/50 focus:border-pine focus:outline-hidden"
            inputMode="numeric"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          🩸 SpO₂ (%)
          <input
            type="number"
            min={70}
            max={100}
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
            placeholder="e.g. 97"
            className="rounded-[12px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/50 focus:border-pine focus:outline-hidden"
            inputMode="numeric"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          🫁 Respiratory Rate (/min)
          <input
            type="number"
            min={4}
            max={60}
            value={rr}
            onChange={(e) => setRr(e.target.value)}
            placeholder="e.g. 16"
            className="rounded-[12px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/50 focus:border-pine focus:outline-hidden"
            inputMode="numeric"
          />
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 bg-pine text-white hover:bg-pine/90 font-semibold rounded-[12px]"
          onClick={handleSave}
        >
          Save Manual Scan
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-line bg-surface text-ink hover:bg-surface/80 rounded-[12px]"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DebugHud({ info }: { info: DebugInfo }) {
  const modelColor =
    info.modelState === "ready"
      ? "text-emerald-400"
      : info.modelState === "fallback"
      ? "text-amber-400"
      : "text-rose-400";

  return (
    <div className="pointer-events-none absolute bottom-20 inset-x-0 flex flex-col gap-0.5 bg-black/80 px-2 py-1 font-mono text-[10px] text-zinc-300 z-10">
      <span className={modelColor}>modelState: {info.modelState}</span>
      <span>
        video: ready={info.videoReady ? "yes" : "no"} {info.videoW}×{info.videoH}
      </span>
      <span className={info.facesPerSec > 0 ? "text-emerald-400" : "text-rose-400"}>
        faces/s: {info.facesPerSec}
      </span>
      <span className={info.roiSource !== "none" ? "text-emerald-400" : "text-zinc-500"}>
        ROI source: {info.roiSource}
      </span>
    </div>
  );
}

function formatTimestamp(timestamp: number, locale: Locale): string {
  const localeTag = locale === "hi" ? "hi-IN" : "en-IN";
  return new Date(timestamp).toLocaleString(localeTag);
}