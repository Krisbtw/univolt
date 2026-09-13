import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SPO2_SCAN_DURATION_MS, useSpo2FingerScan } from "../hooks/useSpo2FingerScan";
import { useFusionSession } from "../lib/fusionStore";
import { getStrings } from "../lib/translations";
import { selectPatient, useUnivolt } from "../lib/univolt/store";
import { makeId } from "../lib/univolt/database";
import { evaluateTriage } from "../lib/triage";
import { loadLocale, loadScans, saveScan, updateScanSpo2 } from "../lib/vitalsDatabase";

interface Spo2FingerScanScreenProps {
  patientId?: string;
}

export function Spo2FingerScanScreen({ patientId }: Spo2FingerScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);
  const { state, actions } = useSpo2FingerScan({ videoRef, ppgCanvasRef: waveformRef });
  const locale = loadLocale() ?? "en";
  const t = useMemo(() => getStrings(locale), [locale]);
  const [manualValue, setManualValue] = useState("");
  const [manualSaved, setManualSaved] = useState(false);
  const setSpo2 = useFusionSession((session) => session.setSpo2);
  const updateLatestVitalsSpo2 = useUnivolt((session) => session.updateLatestVitalsSpo2);
  const addManualSpo2 = useUnivolt((session) => session.addManualSpo2);
  const db = useUnivolt((session) => session.db);
  const patient = patientId ? selectPatient(db, patientId) : null;

  const persistCameraResult = useCallback(() => {
    const result = state.result;
    if (!result) return;
    setSpo2(result.spo2, result.quality);
    if (patientId && result.spo2 !== null && result.quality !== "reject") {
      updateLatestVitalsSpo2(patientId, result.spo2, result.quality);
    } else if (!patientId && result.spo2 !== null && result.quality !== "reject") {
      const latest = loadScans().find((scan) => scan.mode === "live");
      if (latest) {
        // Standalone /scan uses the small history database; the patient screen
        // uses the patient database above.
        updateScanSpo2(latest.id, result.spo2, result.quality);
      }
    }
  }, [patientId, setSpo2, state.result, updateLatestVitalsSpo2]);

  useEffect(() => {
    if (state.phase === "complete") persistCameraResult();
  }, [persistCameraResult, state.phase]);

  const saveManual = useCallback(() => {
    const value = Number(manualValue);
    if (!Number.isFinite(value) || value < 70 || value > 100) return;
    setSpo2(value, "manual");
    if (patientId) addManualSpo2(patientId, value);
    else {
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
    if (state.phase === "idle") actions.start();
  }, [actions.start, state.phase]);

  if (patientId && !patient) {
    return (
      <div style={screenStyle}>
        <div style={wrapStyle}>
          <h1 style={titleStyle}>{t.spo2PatientNotFound}</h1>
          <Link to="/" style={backLinkStyle}>{t.spo2Back}</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={screenStyle}>
      <div style={wrapStyle}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>{t.spo2Title}</h1>
            {patient ? <p style={subtitleStyle}>{patient.name}</p> : null}
          </div>
          {patientId ? (
            <Link to="/patient/$id" params={{ id: patientId }} style={backLinkStyle}>← {t.spo2Back}</Link>
          ) : (
            <Link to="/scan" style={backLinkStyle}>← {t.spo2Back}</Link>
          )}
        </header>

        <section style={cameraSectionStyle}>
          <video ref={videoRef} style={videoStyle} autoPlay playsInline muted />
          <canvas ref={waveformRef} style={waveformStyle} />
          {(state.phase === "positioning" || state.phase === "measuring") && (
            <div style={hudStyle}>
              <span style={hudTextStyle}>
                {state.phase === "positioning" ? t.spo2Positioning : `${t.spo2Measuring} · ${remainingSec}s`}
              </span>
              {state.status === "no_contact" ? <span style={warningStyle}>{t.spo2NoContact}</span> : null}
            </div>
          )}
          {state.phase === "measuring" ? (
            <div style={progressTrackStyle}>
              <div style={{ ...progressFillStyle, width: `${progress}%` }} />
            </div>
          ) : null}
        </section>

        {state.phase === "idle" && !manualAvailable ? (
          <button style={primaryButtonStyle} onClick={actions.start}>
            {t.spo2StartButton}
          </button>
        ) : null}

        {state.phase === "measuring" ? (
          <button style={secondaryButtonStyle} onClick={actions.cancel}>
            {t.spo2CancelButton}
          </button>
        ) : null}

        {state.phase === "complete" ? (
          <section style={resultCardStyle}>
            <h2 style={resultTitleStyle}>{detected ? t.spo2Complete : t.unableToDetect}</h2>
            {detected && state.result ? (
              <>
                <p style={resultValueStyle}>{state.result.spo2}<span style={resultUnitStyle}>%</span></p>
                <p style={mutedStyle}>{t.spo2ResultLabel} — {t.spo2ScreeningDisclaimer}</p>
              </>
            ) : (
              <p style={mutedStyle}>{t.spo2UnableBody}</p>
            )}
            <p style={hygieneStyle}>{t.spo2Hygiene}</p>
            <button style={primaryButtonStyle} onClick={actions.reset}>
              {t.spo2NewScanButton}
            </button>
          </section>
        ) : null}

        {manualAvailable ? (
          <section style={manualCardStyle}>
            <h2 style={resultTitleStyle}>
              {state.status === "camera_error" ? t.spo2CameraError : t.spo2TorchUnavailable}
            </h2>
            <label style={labelStyle}>
              {t.spo2ManualLabel}
              <input
                type="number"
                min={70}
                max={100}
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder={t.spo2ManualPlaceholder}
                style={inputStyle}
                inputMode="numeric"
              />
            </label>
            <button style={primaryButtonStyle} onClick={saveManual} disabled={!manualValue}>
              {manualSaved ? t.spo2ManualSaved : t.spo2ManualSave}
            </button>
          </section>
        ) : null}

        <p style={disclaimerStyle}>{t.disclaimer}</p>
      </div>
    </div>
  );
}

const screenStyle = {
  minHeight: "100vh",
  background: "#0b1120",
  color: "#e2e8f0",
  fontFamily: 'system-ui, "Segoe UI", sans-serif',
  padding: "20px 16px 48px",
  boxSizing: "border-box" as const,
};
const wrapStyle = { maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column" as const, gap: 16 };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 };
const titleStyle = { margin: 0, fontSize: 22, fontWeight: 700 };
const subtitleStyle = { margin: "4px 0 0", fontSize: 13, color: "#94a3b8" };
const backLinkStyle = { color: "#34d399", fontSize: 13, textDecoration: "none" };
const cameraSectionStyle = { position: "relative" as const, height: 360, overflow: "hidden" as const, borderRadius: 14, background: "#000", border: "1px solid #1e293b" };
const videoStyle = { width: "100%", height: "100%", objectFit: "cover" as const, opacity: 0.32, filter: "brightness(0.7)" };
const waveformStyle = { position: "absolute" as const, left: 0, right: 0, bottom: 0, width: "100%", height: 100, background: "rgba(2,6,23,0.66)" };
const hudStyle = { position: "absolute" as const, inset: 0, display: "flex", flexDirection: "column" as const, justifyContent: "space-between", alignItems: "center", padding: 16, pointerEvents: "none" as const };
const hudTextStyle = { background: "rgba(2,6,23,0.78)", padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, textAlign: "center" as const };
const warningStyle = { background: "rgba(127,29,29,0.85)", color: "#fecaca", padding: "8px 12px", borderRadius: 10, fontSize: 12 };
const progressTrackStyle = { position: "absolute" as const, left: 14, right: 14, bottom: 110, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.14)", overflow: "hidden" as const };
const progressFillStyle = { height: "100%", background: "#fb7185", transition: "width 0.25s linear" };
const primaryButtonStyle = { background: "#34d399", color: "#052e22", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const secondaryButtonStyle = { background: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const resultCardStyle = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px" };
const manualCardStyle = { ...resultCardStyle, display: "flex", flexDirection: "column" as const, gap: 12 };
const resultTitleStyle = { margin: 0, fontSize: 16, fontWeight: 700 };
const resultValueStyle = { margin: "12px 0 0", fontSize: 48, fontWeight: 700, color: "#fb7185" };
const resultUnitStyle = { marginLeft: 6, fontSize: 18, color: "#94a3b8" };
const mutedStyle = { margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: "#94a3b8" };
const hygieneStyle = { margin: "14px 0", fontSize: 12, color: "#fbbf24" };
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13, color: "#94a3b8", fontWeight: 600 };
const inputStyle = { background: "#020617", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", fontSize: 16, color: "#e2e8f0" };
const disclaimerStyle = { margin: 0, fontSize: 11, color: "#64748b", textAlign: "center" as const };