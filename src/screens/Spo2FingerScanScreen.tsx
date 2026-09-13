import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SPO2_SCAN_DURATION_MS, useSpo2FingerScan } from "../hooks/useSpo2FingerScan";
import { useFusionSession } from "../lib/fusionStore";
import { getStrings } from "../lib/translations";
import { selectPatient, useUnivolt } from "../lib/univolt/store";
import { makeId } from "../lib/univolt/database";
import { evaluateTriage } from "../lib/triage";
import { loadLocale, loadScans, saveScan } from "../lib/vitalsDatabase";

interface Spo2FingerScanScreenProps {
  patientId?: string;
}

export function Spo2FingerScanScreen({ patientId }: Spo2FingerScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useSpo2FingerScan({
    videoRef,
    ppgCanvasRef: waveformRef,
    patientId,
  });

  const locale = loadLocale() ?? "en";
  const t = useMemo(() => getStrings(locale), [locale]);
  const [manualValue, setManualValue] = useState("");
  const [manualSaved, setManualSaved] = useState(false);
  const setSpo2 = useFusionSession((session) => session.setSpo2);
  const addManualSpo2 = useUnivolt((session) => session.addManualSpo2);
  const db = useUnivolt((session) => session.db);
  const patient = patientId ? selectPatient(db, patientId) : null;

  const saveManual = useCallback(() => {
    const value = Number(manualValue);
    if (!Number.isFinite(value) || value < 60 || value > 100) return;
    setSpo2(value, "manual");
    if (patientId) {
      addManualSpo2(patientId, value);
    } else {
      saveScan({
        id: makeId("m"),
        timestamp: Date.now(),
        mode: "manual",
        bpm: null,
        hrv: null,
        spo2: Math.round(value),
        spo2Quality: "manual",
        rr: null,
        locale,
        triageLevel: evaluateTriage({ bpm: null, hrv: null, spo2: value, rr: null }).level,
      });
    }
    setManualValue("");
    setManualSaved(true);
    setTimeout(() => setManualSaved(false), 3000);
  }, [addManualSpo2, locale, manualValue, patientId, setSpo2]);

  const remainingSec = Math.max(
    0,
    Math.ceil((SPO2_SCAN_DURATION_MS - state.progressMs) / 1000),
  );
  const progress = Math.min(100, (state.progressMs / SPO2_SCAN_DURATION_MS) * 100);
  const detected = state.phase === "complete" && state.result?.spo2 != null;
  const manualAvailable =
    state.status === "unavailable" ||
    state.status === "camera_error" ||
    state.permission === "unsupported" ||
    state.permission === "denied";

  useEffect(() => {
    if (state.phase === "idle") {
      actions.start();
    }
  }, [actions, state.phase]);

  if (patientId && !patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title={t.spo2PatientNotFound} />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-muted text-sm">{t.spo2PatientNotFound}</p>
          <Link to="/">
            <Button variant="secondary">{t.spo2Back}</Button>
          </Link>
        </main>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppHeader
        back={
          patientId
            ? { to: "/patient/$id", params: { id: patientId } }
            : { to: "/scan" }
        }
        title={t.spo2Title}
        subtitle={patient ? patient.name : "Pulse oximetry screening"}
      />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-4 text-ink">
        {/* Rear camera viewfinder with live waveform */}
        {!manualAvailable && (
          <section className="relative h-64 w-full overflow-hidden rounded-[20px] bg-black shadow-inner border border-line">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover opacity-40 filter brightness-90"
            />
            <canvas
              ref={waveformRef}
              width={600}
              height={100}
              className="absolute bottom-0 left-0 right-0 h-24 w-full opacity-90"
            />

            {(state.phase === "positioning" || state.phase === "measuring") && (
              <div className="absolute inset-0 flex flex-col justify-between items-center p-3.5 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/50">
                <div className="rounded-full border border-white/20 bg-black/60 px-3.5 py-1 text-center backdrop-blur-sm">
                  <p className="text-xs font-semibold text-white leading-tight">
                    {state.phase === "positioning"
                      ? t.spo2Positioning
                      : `${t.spo2Measuring} · ${remainingSec}s`}
                  </p>
                </div>

                {state.phase === "measuring" && (
                  <p className="text-[11px] text-zinc-300 font-medium bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                    Keep finger pressed firmly over lens &amp; flash
                  </p>
                )}

                {state.status === "no_contact" ? (
                  <div className="rounded-xl border border-red-500/40 bg-red-950/80 px-3 py-1.5 text-center text-xs text-red-200 backdrop-blur-md">
                    {t.spo2NoContact}
                  </div>
                ) : state.phase === "positioning" ? (
                  <div className="rounded-xl border border-pine/40 bg-black/60 px-3 py-1 text-xs text-trace backdrop-blur-md">
                    Waiting for fingertip contact…
                  </div>
                ) : null}
              </div>
            )}

            {/* Progress bar */}
            {state.phase === "measuring" && (
              <div className="absolute bottom-24 left-4 right-4 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-pine transition-all duration-250"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </section>
        )}

        {/* Measuring action control */}
        {state.phase === "measuring" && (
          <Button variant="secondary" onClick={actions.cancel} className="w-full text-xs">
            {t.spo2CancelButton}
          </Button>
        )}

        {/* Scan complete card */}
        {state.phase === "complete" && (
          <section className="rounded-[20px] border border-line bg-paper p-5 shadow-sm flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              {detected ? t.spo2Complete : t.unableToDetect}
            </h2>

            {detected && state.result?.spo2 != null ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl font-bold tracking-tight text-pine">
                    {state.result.spo2}
                  </span>
                  <span className="text-xl font-bold text-muted">%</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-pine/10 border border-pine/30 px-2.5 py-0.5 text-[11px] font-semibold text-pine">
                    {state.result.quality === "good" ? "Good signal" : "Weak signal"}
                  </span>
                  <span className="text-xs text-muted">
                    {state.result.contactSec.toFixed(0)}s contact
                  </span>
                </div>

                <p className="text-xs text-muted leading-relaxed pt-1">
                  <strong>{t.spo2ResultLabel}</strong> — {t.spo2ScreeningDisclaimer}.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted leading-relaxed">
                  {t.spo2UnableBody} Cover the camera lens and torch completely and keep still for the full 20 seconds.
                </p>
              </div>
            )}

            <p className="text-[11px] font-semibold text-amber-800 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-[12px]">
              🧼 {t.spo2Hygiene}
            </p>

            <div className="flex gap-2 pt-1">
              <Button variant="default" onClick={actions.reset} className="flex-1 text-xs">
                {t.spo2NewScanButton}
              </Button>
              {patientId ? (
                <Link to="/patient/$id" params={{ id: patientId }} className="flex-1">
                  <Button variant="secondary" className="w-full text-xs">
                    Back to record
                  </Button>
                </Link>
              ) : (
                <Link to="/fusion" className="flex-1">
                  <Button variant="secondary" className="w-full text-xs">
                    Triage summary →
                  </Button>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Manual entry card — shown prominently if device is unavailable/unsupported, or below result */}
        {(manualAvailable || state.phase === "complete") && (
          <section className="rounded-[20px] border border-line bg-paper p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                {manualAvailable
                  ? state.status === "camera_error"
                    ? t.spo2CameraError
                    : t.spo2TorchUnavailable
                  : t.spo2ManualLabel}
              </h2>
              <span className="rounded-full bg-surface border border-line px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                {t.spo2ManualPoint}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted">
                {t.spo2ManualLabel} (60–100%)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={60}
                  max={100}
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={t.spo2ManualPlaceholder}
                  inputMode="numeric"
                  className="flex-1 rounded-[12px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-pine font-medium"
                />
                <Button
                  variant="default"
                  onClick={saveManual}
                  disabled={!manualValue || Number(manualValue) < 60 || Number(manualValue) > 100}
                  className="text-xs px-4"
                >
                  {manualSaved ? t.spo2ManualSaved : t.spo2ManualSave}
                </Button>
              </div>
            </div>

            {manualSaved && (
              <p className="text-xs text-pine font-semibold animate-pulse">
                ✓ SpO₂ saved successfully and updated in triage!
              </p>
            )}

            {manualAvailable && (
              <div className="pt-2">
                {patientId ? (
                  <Link to="/patient/$id" params={{ id: patientId }}>
                    <Button variant="secondary" className="w-full text-xs">
                      ← {t.spo2Back} to patient
                    </Button>
                  </Link>
                ) : (
                  <Link to="/scan">
                    <Button variant="secondary" className="w-full text-xs">
                      ← {t.spo2Back} to face scan
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </section>
        )}

        <p className="text-[11px] text-muted text-center leading-relaxed">
          {t.disclaimer}
        </p>
      </main>
    </AppFrame>
  );
}