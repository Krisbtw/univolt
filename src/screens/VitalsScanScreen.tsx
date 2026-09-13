import { SpeakerButton } from "@/components/communication/speaker-button";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SCAN_DURATION_MS, useRppgScan, type DebugInfo, type Status } from "../hooks/useRppgScan";
import { evaluateTriage, type TriageResult } from "../lib/triage";
import { getStrings, type Locale, type Strings } from "../lib/translations";
import { useFusionSession } from "../lib/fusionStore";
import { Link } from "@tanstack/react-router";
import {
    clearScans,
    loadLocale,
    loadScans,
    makeId,
    saveLocale,
    saveScan,
    type ScanRecord,
} from "../lib/vitalsDatabase";

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

    const startButtonEnabled = state.phase === "positioning" && state.roiActive && state.status !== "low_light";

    // Debug HUD — toggled by ?debug=1 in the URL, never visible in normal demo
    const [debugEnabled] = useState(() => {
        try {
            return new URLSearchParams(window.location.search).get("debug") === "1";
        } catch {
            return false;
        }
    });
    const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
    useEffect(() => {
        if (!debugEnabled) return;
        const id = setInterval(() => {
            setDebugInfo(actions.getDebugInfo());
        }, 250);
        return () => clearInterval(id);
    }, [debugEnabled, actions]);

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
        // Task 2: feed rPPG result into the fusion session store
        setRppg({ bpm: result.bpm, rr: result.rr, hrv: result.hrv, quality: result.quality });
        setHistory(loadScans());
    }, [state.result, triage, locale, setRppg]);

    // --- Feature 5: Manual entry state ---
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
        <div style={screenStyle}>
            <div style={wrapStyle}>
                <header style={headerStyle}>
                    <div>
                        <h1 style={titleStyle}>{t.appTitle}</h1>
                        <p style={taglineStyle}>{t.tagline}</p>
                    </div>
                    <span style={liveBadgeStyle}>{t.liveBadge}</span>
                </header>

                <section style={cameraSectionStyle}>
                    <video
                        ref={videoRef}
                        style={cameraGranted ? videoStyle : videoDimStyle}
                        autoPlay
                        playsInline
                        muted
                    />
                    {cameraGranted && (state.phase === "positioning" || measuring) && (
                        <div style={ovalGuideStyle} aria-hidden />
                    )}
                    {(state.phase === "positioning" || measuring) && (
                        <div style={hudStyle}>
                            <span style={hudTextStyle}>
                                {state.phase === "positioning"
                                    ? t.faceGuide
                                    : `${t.measuringLabel}${t.separator}${remainingSec}${t.secUnit}`}
                            </span>
                            {statusText !== null && (
                                <span style={statusPillStyle(state.status)}>{statusText}</span>
                            )}
                        </div>
                    )}
                    {measuring && (
                        <div style={progressTrackStyle}>
                            <div style={{ ...progressFillStyle, width: `${progressPct}%` }} />
                        </div>
                    )}
                    <canvas ref={ppgCanvasRef} style={ppgCanvasStyle} />
                    {debugEnabled && debugInfo !== null && (
                        <DebugHud info={debugInfo} />
                    )}
                    {showPermissionFallback && (
                        <PermissionFallback
                            t={t}
                            unsupported={state.permission === "unsupported"}
                            onGrant={actions.requestCamera}
                        />
                    )}
                </section>

                {/* Manual start button during positioning — enabled when ROI active and not low light */}
                {state.phase === "positioning" && cameraGranted && (
                    <button
                        id="btn-manual-start-scan"
                        style={{
                            ...primaryButtonStyle,
                            opacity: startButtonEnabled ? 1 : 0.45,
                            cursor: startButtonEnabled ? "pointer" : "not-allowed",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            width: "100%",
                        }}
                        disabled={!startButtonEnabled}
                        onClick={actions.startScan}
                    >
                        ▶ Start scan
                    </button>
                )}

                {/* Feature 5: Manual entry toggle — shown when idle or permission denied */}
                {(state.phase === "idle" || showPermissionFallback) && !showManual && (
                    <button
                        style={secondaryButtonStyle}
                        onClick={() => setShowManual(true)}
                    >
                        📋 Camera failed? Enter vitals manually
                    </button>
                )}
                {showManual && (
                    <ManualEntryForm
                        t={t}
                        onSave={handleManualSave}
                        onCancel={() => setShowManual(false)}
                    />
                )}

                {result === null ? (
                    <div style={metricsRowStyle}>
                        <MetricTile
                            label={t.metricHeartRate}
                            value={measuring ? state.liveBpm : null}
                            unit={t.metricHeartRateUnit}
                            note={null}
                            placeholder={t.placeholder}
                            separator={t.separator}
                            icon={METRIC_ICONS.heartRate}
                        />
                        <MetricTile
                            label={t.metricHrv}
                            value={null}
                            unit={t.metricHrvUnit}
                            note={null}
                            placeholder={t.placeholder}
                            separator={t.separator}
                            icon={METRIC_ICONS.hrv}
                        />
                        <MetricTile
                            label={t.metricRespRate}
                            value={null}
                            unit={t.metricRespRateUnit}
                            note={t.metricRespRateNote}
                            placeholder={t.placeholder}
                            separator={t.separator}
                            icon={METRIC_ICONS.respRate}
                        />
                    </div>
                ) : detected ? (
                    <>
                        <div style={metricsRowStyle}>
                            <MetricTile
                                label={t.metricHeartRate}
                                value={result.bpm}
                                unit={t.metricHeartRateUnit}
                                note={null}
                                placeholder={t.placeholder}
                                separator={t.separator}
                                icon={METRIC_ICONS.heartRate}
                            />
                            <MetricTile
                                label={t.metricHrv}
                                value={result.hrv}
                                unit={t.metricHrvUnit}
                                note={null}
                                placeholder={t.placeholder}
                                separator={t.separator}
                                icon={METRIC_ICONS.hrv}
                            />
                            <MetricTile
                                label={t.metricRespRate}
                                value={result.rr}
                                unit={t.metricRespRateUnit}
                                note={t.metricRespRateNote}
                                placeholder={t.placeholder}
                                separator={t.separator}
                                icon={METRIC_ICONS.respRate}
                            />
                        </div>
                        <p style={qualityStyle}>
                            {`${t.qualityLabel}: ${result.quality === "good" ? t.qualityGood : t.qualityWeak}${t.separator}${result.snrDb.toFixed(1)} dB`}
                        </p>
                    </>
                ) : (
                    <div style={unableCardStyle}>
                        <h3 style={unableTitleStyle}>{t.unableToDetect}</h3>
                        <p style={unableBodyStyle}>{t.unableToDetectBody}</p>
                    </div>
                )}

                {state.phase === "complete" && detected && triage !== null && (
                    <GuidanceCard t={t} triage={triage} locale={locale} onSetLocale={setLocale} />
                )}
                {state.phase === "complete" && detected && (
                    <Link to="/spo2" style={secondaryButtonStyle}>
                        {t.spo2AddButton}
                    </Link>
                )}
                {state.phase === "complete" && (
                    <button style={primaryButtonStyle} onClick={actions.reset}>
                        {t.newScanButton}
                    </button>
                )}

                <HistoryList history={history} t={t} onClear={handleClearHistory} />
                <p style={disclaimerStyle}>{t.disclaimer}</p>
            </div>
        </div>
    );
}

// ---------- Debug HUD (only rendered when ?debug=1) ----------
interface DebugHudProps { info: DebugInfo; }
function DebugHud({ info }: DebugHudProps) {
    const modelColor =
        info.modelState === "ready" ? "#4ade80" :
        info.modelState === "fallback" ? "#fbbf24" : "#f87171";
    return (
        <div style={debugHudStyle}>
            <span style={{ color: modelColor }}>
                modelState: {info.modelState} ({info.lastModelSource})
            </span>
            {info.lastModelError && info.lastModelError !== "none" && (
                <span style={{ color: "#f87171" }}>err: {info.lastModelError.slice(0, 60)}</span>
            )}
            <span>
                video: ready={info.videoReadyState} {info.videoWidth}×{info.videoHeight}
            </span>
            <span style={{ color: info.facesLastSec > 0 ? "#4ade80" : "#f87171" }}>
                faces/s: {info.facesLastSec}
            </span>
            <span style={{ color: info.roiSource !== "none" ? "#4ade80" : "#64748b" }}>
                ROI source: {info.roiSource}
            </span>
            <span>
                phase: {info.phase} | status: {info.status}
            </span>
            <span>
                activeMs: {Math.round(info.activeMs)}ms
            </span>
        </div>
    );
}
const debugHudStyle: CSSProperties = {
    position: "absolute",
    bottom: 104,
    left: 0,
    right: 0,
    padding: "4px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    background: "rgba(2,6,23,0.85)",
    fontFamily: "monospace",
    fontSize: 11,
    color: "#94a3b8",
    pointerEvents: "none",
    zIndex: 10,
};

// ---------- sub-components (all copy comes from translations.ts) ----------
// Feature 4: metric icons
const METRIC_ICONS: Record<string, string> = {
    heartRate: "❤️",
    hrv: "💓",
    respRate: "🫁",
    spo2: "🩸",
};

interface MetricTileProps {
    label: string;
    value: number | null;
    unit: string;
    note: string | null;
    placeholder: string;
    separator: string;
    icon?: string;
}
function MetricTile({ label, value, unit, note, placeholder, separator, icon }: MetricTileProps) {
    return (
        <div style={metricTileStyle}>
            <span style={metricLabelStyle}>
                {icon ? <span style={{ marginRight: 4 }}>{icon}</span> : null}{label}
            </span>
            <span style={metricValueStyle}>
                {value === null ? placeholder : Math.round(value)}
                <span style={metricUnitStyle}>{unit}</span>
            </span>
            {note !== null ? <span style={metricNoteStyle}>{`${separator}${note}`}</span> : null}
        </div>
    );
}

interface PermissionFallbackProps {
    t: Strings;
    unsupported: boolean;
    onGrant: () => void;
}
function PermissionFallback({ t, unsupported, onGrant }: PermissionFallbackProps) {
    return (
        <div style={permissionCardStyle}>
            <h3 style={permissionTitleStyle}>
                {unsupported ? t.permissionUnsupportedTitle : t.permissionDeniedTitle}
            </h3>
            <p style={permissionBodyStyle}>
                {unsupported ? t.permissionUnsupportedBody : t.permissionDeniedBody}
            </p>
            {!unsupported && (
                <button style={primaryButtonStyle} onClick={onGrant}>
                    {t.grantPermissionButton}
                </button>
            )}
        </div>
    );
}

interface GuidanceCardProps {
    t: Strings;
    triage: TriageResult;
    locale: Locale;
    onSetLocale: (locale: Locale) => void;
}
function GuidanceCard({ t, triage, locale, onSetLocale }: GuidanceCardProps) {
    const branch = t.guidance.triage[triage.level];
    const headingColor = triage.urgent ? "#f87171" : triage.referral ? "#fbbf24" : "#4ade80";

    // Feature 3: SMS share
    function handleSmsShare() {
        const text = `[UniCare Health] ${branch.title}\n${branch.body}`;
        window.open("sms:?body=" + encodeURIComponent(text));
    }

    return (
        <div style={guidanceCardStyle}>
            <div style={guidanceHeaderStyle}>
                <h3 style={{ ...guidanceTitleStyle, color: headingColor }}>{t.guidanceTitle}</h3>
                <div style={languageRowStyle}>
                    <span style={languageLabelStyle}>{t.languageLabel}</span>
                    <button
                        style={locale === "en" ? localeButtonActiveStyle : localeButtonStyle}
                        onClick={() => onSetLocale("en")}
                    >
                        {t.localeNameEn}
                    </button>
                    <button
                        style={locale === "hi" ? localeButtonActiveStyle : localeButtonStyle}
                        onClick={() => onSetLocale("hi")}
                    >
                        {t.localeNameHi}
                    </button>
                </div>
            </div>
            <p style={guidanceIntroStyle}>{t.guidanceIntro}</p>
            <h4 style={branchTitleStyle}>{branch.title}</h4>
            <p style={branchBodyStyle}>{branch.body}</p>
            {/* Read aloud (Mode A) — offline TTS, only on tap. */}
            <SpeakerButton
                text={`${branch.title}. ${branch.body}`}
                locale={locale}
                t={t}
                className="mt-2"
            />
            {triage.referral && (
                <p style={referralStyle}>
                    {triage.urgent ? (
                        <strong style={urgentStyle}>{t.guidance.urgentPrefix}</strong>
                    ) : null}
                    {t.guidance.referralLine}
                </p>
            )}
            {/* Feature 3: Share via SMS */}
            <button style={smsButtonStyle} onClick={handleSmsShare}>
                📱 Share via SMS / WhatsApp
            </button>
        </div>
    );
}

interface HistoryListProps {
    history: ScanRecord[];
    t: Strings;
    onClear: () => void;
}
function HistoryList({ history, t, onClear }: HistoryListProps) {
    return (
        <div style={historyCardStyle}>
            <div style={historyHeaderStyle}>
                <h3 style={historyTitleStyle}>{t.historyTitle}</h3>
                {history.length > 0 && (
                    <button style={clearButtonStyle} onClick={onClear}>
                        {t.clearHistoryButton}
                    </button>
                )}
            </div>
            {history.length === 0 ? (
                <p style={historyEmptyStyle}>{t.historyEmpty}</p>
            ) : (
                <ul style={historyListStyle}>
                    {history.map((record) => (
                        <li key={record.id} style={historyRowStyle}>
                            <span style={historyDateStyle}>{formatTimestamp(record.timestamp, record.locale)}</span>
                            <span style={liveBadgeStyle}>
                                {record.mode === "manual" ? "✍️ Manual" : t.liveBadge}
                            </span>
                            {/* Feature 4: icons in history rows */}
                            <span style={historyMetricsStyle}>
                                {`❤️ ${t.metricHeartRate}: ${record.bpm ?? t.placeholder} ${t.metricHeartRateUnit}${t.separator}🫁 ${t.metricRespRate}: ${record.rr ?? t.placeholder} ${t.metricRespRateUnit}${record.spo2 != null ? `${t.separator}🩸 SpO₂: ${record.spo2}%` : ""}`}
                            </span>
                            <span style={historyTriageStyle}>
                                {t.guidance.triage[record.triageLevel].title}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function formatTimestamp(timestamp: number, locale: Locale): string {
    const localeTag = locale === "hi" ? "hi-IN" : "en-IN";
    return new Date(timestamp).toLocaleString(localeTag);
}

function statusColor(status: Status): string {
    switch (status) {
        case "ok":
            return "#4ade80";
        case "weak_signal":
        case "model_fallback":
            return "#fbbf24";
        default:
            return "#f87171";
    }
}

// ---------- styles (module-level constants; never recreated per render) ----------
const screenStyle: CSSProperties = {
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e2e8f0",
    fontFamily: 'system-ui, "Segoe UI", sans-serif',
    padding: "20px 16px 48px",
    boxSizing: "border-box",
};
const wrapStyle: CSSProperties = {
    maxWidth: 720,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
};
const headerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
};
const titleStyle: CSSProperties = { margin: 0, fontSize: 22, fontWeight: 700 };
const taglineStyle: CSSProperties = { margin: "2px 0 0", fontSize: 13, color: "#94a3b8" };
const liveBadgeStyle: CSSProperties = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    background: "rgba(52,211,153,0.15)",
    color: "#34d399",
    border: "1px solid rgba(52,211,153,0.4)",
    alignSelf: "flex-start",
};
const cameraSectionStyle: CSSProperties = {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    background: "#000",
    border: "1px solid #1e293b",
};
const videoStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: 300,
    objectFit: "cover",
    background: "#000",
    transform: "scaleX(-1)", // mirror the front camera preview
};
const videoDimStyle: CSSProperties = { ...videoStyle, opacity: 0.2 };
const ovalGuideStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 190,
    height: 240,
    marginTop: -120,
    marginLeft: -95,
    borderRadius: "50%",
    border: "2px dashed rgba(148,163,184,0.55)",
    boxShadow: "0 0 0 9999px rgba(2,6,23,0.35)",
    pointerEvents: "none",
};
const hudStyle: CSSProperties = {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "0 12px",
};
const hudTextStyle: CSSProperties = {
    background: "rgba(2,6,23,0.72)",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
};
const statusPill = (color: string): CSSProperties => ({
    background: "rgba(2,6,23,0.72)",
    color,
    border: `1px solid ${color}55`,
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
});
function statusPillStyle(status: Status): CSSProperties {
    return statusPill(statusColor(status));
}
const progressTrackStyle: CSSProperties = {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 104,
    height: 6,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
};
const progressFillStyle: CSSProperties = {
    height: "100%",
    background: "#34d399",
    transition: "width 0.25s linear",
};
const ppgCanvasStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "100%",
    height: 96,
    background: "rgba(2,6,23,0.55)",
};
const metricsRowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
};
const metricTileStyle: CSSProperties = {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
};
const metricLabelStyle: CSSProperties = { fontSize: 12, color: "#94a3b8", fontWeight: 600 };
const metricValueStyle: CSSProperties = { fontSize: 30, fontWeight: 700, lineHeight: 1.1 };
const metricUnitStyle: CSSProperties = { fontSize: 13, marginLeft: 6, color: "#94a3b8" };
const metricNoteStyle: CSSProperties = { fontSize: 11, color: "#64748b" };
const qualityStyle: CSSProperties = { margin: 0, fontSize: 12, color: "#94a3b8" };
const unableCardStyle: CSSProperties = {
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.35)",
    borderRadius: 12,
    padding: "16px 18px",
};
const unableTitleStyle: CSSProperties = {
    margin: "0 0 6px",
    fontSize: 18,
    fontWeight: 700,
    color: "#f87171",
};
const unableBodyStyle: CSSProperties = { margin: 0, fontSize: 14, color: "#cbd5e1" };
const permissionCardStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 24,
    textAlign: "center",
    background: "rgba(2,6,23,0.88)",
};
const permissionTitleStyle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700 };
const permissionBodyStyle: CSSProperties = {
    margin: 0,
    fontSize: 13,
    color: "#94a3b8",
    maxWidth: 360,
};
const primaryButtonStyle: CSSProperties = {
    background: "#34d399",
    color: "#052e22",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
};
const guidanceCardStyle: CSSProperties = {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "16px 18px",
};
const guidanceHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
};
const guidanceTitleStyle: CSSProperties = { margin: 0, fontSize: 16, fontWeight: 700 };
const languageRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const languageLabelStyle: CSSProperties = { fontSize: 12, color: "#94a3b8" };
const localeButtonStyle: CSSProperties = {
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
};
const localeButtonActiveStyle: CSSProperties = {
    ...localeButtonStyle,
    color: "#34d399",
    borderColor: "rgba(52,211,153,0.5)",
};
const guidanceIntroStyle: CSSProperties = {
    margin: "10px 0 4px",
    fontSize: 12,
    color: "#94a3b8",
};
const branchTitleStyle: CSSProperties = { margin: "8px 0 4px", fontSize: 15, fontWeight: 700 };
const branchBodyStyle: CSSProperties = {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "#cbd5e1",
};
const referralStyle: CSSProperties = {
    margin: "10px 0 0",
    fontSize: 13,
    color: "#fbbf24",
    fontWeight: 600,
};
const urgentStyle: CSSProperties = { color: "#f87171" };
const historyCardStyle: CSSProperties = {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "14px 16px",
};
const historyHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
};
const historyTitleStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700 };
const clearButtonStyle: CSSProperties = {
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
};
const historyEmptyStyle: CSSProperties = { margin: "8px 0 0", fontSize: 13, color: "#64748b" };
const historyListStyle: CSSProperties = {
    listStyle: "none",
    margin: "10px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
};
const historyRowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "8px 0",
    borderBottom: "1px solid #1e293b",
};
const historyDateStyle: CSSProperties = { fontSize: 11, color: "#64748b" };
const historyMetricsStyle: CSSProperties = { fontSize: 13, color: "#cbd5e1" };
const historyTriageStyle: CSSProperties = { fontSize: 12, color: "#94a3b8" };
const disclaimerStyle: CSSProperties = {
    margin: 0,
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
};
const secondaryButtonStyle: CSSProperties = {
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
};
const smsButtonStyle: CSSProperties = {
    marginTop: 12,
    background: "rgba(52,211,153,0.10)",
    color: "#34d399",
    border: "1px solid rgba(52,211,153,0.35)",
    borderRadius: 8,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "block",
    width: "100%",
};
const manualCardStyle: CSSProperties = {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
};
const manualLabelStyle: CSSProperties = { fontSize: 13, color: "#94a3b8", fontWeight: 600 };
const manualInputStyle: CSSProperties = {
    display: "block",
    width: "100%",
    background: "#020617",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    color: "#e2e8f0",
    marginTop: 4,
    boxSizing: "border-box" as const,
};

// ── Feature 5: Manual vitals entry form ─────────────────────────────────────
interface ManualEntryFormProps {
    t: Strings;
    onSave: (bpm: number, spo2: number, rr: number) => void;
    onCancel: () => void;
}
function ManualEntryForm({ onSave, onCancel }: ManualEntryFormProps) {
    const [bpm, setBpm] = useState("");
    const [spo2, setSpo2] = useState("");
    const [rr, setRr] = useState("");
    const [error, setError] = useState<string | null>(null);

    function handleSave() {
        const b = parseInt(bpm, 10);
        const s = parseInt(spo2, 10);
        const r = parseInt(rr, 10);
        if (isNaN(b) || b < 30 || b > 220) { setError("Heart rate must be 30–220 BPM."); return; }
        if (isNaN(s) || s < 70 || s > 100) { setError("SpO₂ must be 70–100%."); return; }
        if (isNaN(r) || r < 4 || r > 60) { setError("Respiratory rate must be 4–60 /min."); return; }
        setError(null);
        onSave(b, s, r);
    }

    return (
        <div style={manualCardStyle}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>✍️ Manual Vitals Entry</h3>
            {error && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>}
            <label style={manualLabelStyle}>
                ❤️ Heart Rate (BPM)
                <input
                    type="number"
                    min={30} max={220}
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value)}
                    placeholder="e.g. 75"
                    style={manualInputStyle}
                    inputMode="numeric"
                />
            </label>
            <label style={manualLabelStyle}>
                🩸 SpO₂ (%)
                <input
                    type="number"
                    min={70} max={100}
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    placeholder="e.g. 97"
                    style={manualInputStyle}
                    inputMode="numeric"
                />
            </label>
            <label style={manualLabelStyle}>
                🫁 Respiratory Rate (/min)
                <input
                    type="number"
                    min={4} max={60}
                    value={rr}
                    onChange={(e) => setRr(e.target.value)}
                    placeholder="e.g. 16"
                    style={manualInputStyle}
                    inputMode="numeric"
                />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
                <button style={primaryButtonStyle} onClick={handleSave}>Save Manual Scan</button>
                <button style={secondaryButtonStyle} onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}