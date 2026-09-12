import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LIVE_CAPTURE_MS, usePpgCapture } from "../hooks/usePpgCapture";
import { DEMO_DURATION_MS, type VitalsMetrics } from "../lib/signalProcessing";
import { evaluateTriage, type TriageResult } from "../lib/triage";
import { getStrings, type Locale, type Strings } from "../lib/translations";
import {
    clearScans,
    loadLocale,
    loadScans,
    saveLocale,
    saveScan,
    type ScanRecord,
} from "../lib/vitalsDatabase";

export function VitalsScanScreen() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const ppgCanvasRef = useRef<HTMLCanvasElement>(null);
    const { state, actions } = usePpgCapture({ videoRef, ppgCanvasRef });

    const [locale, setLocale] = useState<Locale>(() => loadLocale() ?? "en");
    const t: Strings = useMemo(() => getStrings(locale), [locale]);
    const handleSetLocale = useCallback((next: Locale): void => {
        setLocale(next);
    }, []);
    useEffect(() => {
        saveLocale(locale);
    }, [locale]);

    const triage: TriageResult | null = useMemo(
        () => (state.result === null ? null : evaluateTriage(state.result)),
        [state.result],
    );

    const [history, setHistory] = useState<ScanRecord[]>(() => loadScans());
    const savedScanIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const result = state.result;
        if (result === null || triage === null) return;
        if (savedScanIdsRef.current.has(result.scanId)) return; // persist exactly once per scan
        savedScanIdsRef.current.add(result.scanId);
        saveScan({
            id: result.scanId,
            timestamp: result.timestamp,
            mode: result.mode,
            bpm: result.bpm,
            hrv: result.hrv,
            spo2: result.spo2,
            rr: result.rr,
            locale,
            triageLevel: triage.level,
        });
        setHistory(loadScans());
    }, [state.result, triage, locale]);

    const handleClearHistory = useCallback((): void => {
        clearScans();
        setHistory([]);
    }, []);

    // ---- derived view state ----
    const durationMs = state.mode === "demo" ? DEMO_DURATION_MS : LIVE_CAPTURE_MS;
    const progressPct = Math.min(100, (state.progressMs / durationMs) * 100);
    const remainingSec = Math.max(0, Math.ceil((durationMs - state.progressMs) / 1000));
    const inLivePhases =
        state.phase === "idle" || state.phase === "capturing_live" || state.phase === "paused";
    const showContactOverlay =
        inLivePhases && state.permission === "granted" && state.mode !== "demo" && !state.contact;
    const showPermissionFallback =
        (state.permission === "denied" || state.permission === "unsupported") &&
        state.phase === "idle";
    const scanning = state.phase === "capturing_live" || state.phase === "demo_running";
    const metricsReadable = state.mode === "demo" || state.contact;
    const metrics: VitalsMetrics | null =
        state.result !== null
            ? state.result
            : scanning && metricsReadable
                ? state.liveMetrics
                : null;

    return (
        <div style={screenStyle}>
            <div style={wrapStyle}>
                <header style={headerStyle}>
                    <div>
                        <h1 style={titleStyle}>{t.appTitle}</h1>
                        <p style={taglineStyle}>{t.tagline}</p>
                    </div>
                    {state.mode !== null && (
                        <span style={state.mode === "demo" ? demoBadgeStyle : liveBadgeStyle}>
                            {state.mode === "demo" ? t.simulatedBadge : t.liveBadge}
                        </span>
                    )}
                </header>

                <section style={cameraSectionStyle}>
                    <video
                        ref={videoRef}
                        style={state.phase === "demo_running" ? videoDimStyle : videoStyle}
                        autoPlay
                        muted
                        playsInline
                    />
                    <canvas ref={ppgCanvasRef} style={ppgCanvasStyle} />
                    {state.phase === "demo_running" && (
                        <div style={demoBannerStyle}>{t.simulatedBadge}</div>
                    )}
                    {showPermissionFallback && (
                        <PermissionFallback
                            t={t}
                            unsupported={state.permission === "unsupported"}
                            onGrant={actions.requestCamera}
                        />
                    )}
                    {showContactOverlay && (
                        <div style={contactOverlayStyle}>{t.contactOverlay}</div>
                    )}
                </section>

                {scanning || state.phase === "paused" ? (
                    <div style={progressRowStyle}>
                        <div style={progressTrackStyle}>
                            <div
                                style={{
                                    ...progressFillStyle,
                                    width: `${progressPct.toFixed(1)}%`,
                                }}
                            />
                        </div>
                        <span style={progressLabelStyle}>
                            {`${state.phase === "paused" ? t.pausedLabel : t.scanningLabel}${t.separator}${remainingSec}${t.secUnit}`}
                        </span>
                    </div>
                ) : null}

                {state.phase === "idle" &&
                    state.permission !== "denied" &&
                    state.permission !== "unsupported" && (
                        <p style={mutedStyle}>{t.readyHint}</p>
                    )}
                {state.phase === "demo_running" && <p style={mutedStyle}>{t.demoModeNotice}</p>}

                {state.phase === "complete" && (
                    <h2 style={sectionTitleStyle}>{t.scanComplete}</h2>
                )}
                {state.phase === "complete" &&
                    state.result !== null &&
                    state.result.mode === "demo" && (
                        <div style={watermarkStyle}>{t.demoWatermark}</div>
                    )}

                <section style={metricsGridStyle}>
                    <MetricTile
                        label={t.metricHeartRate}
                        value={metrics === null ? null : metrics.bpm}
                        unit={t.metricHeartRateUnit}
                        note={null}
                        placeholder={t.placeholder}
                        separator={t.separator}
                    />
                    <MetricTile
                        label={t.metricHrv}
                        value={metrics === null ? null : metrics.hrv}
                        unit={t.metricHrvUnit}
                        note={null}
                        placeholder={t.placeholder}
                        separator={t.separator}
                    />
                    <MetricTile
                        label={t.metricSpo2}
                        value={metrics === null ? null : metrics.spo2}
                        unit={t.metricSpo2Unit}
                        note={t.metricSpo2Note}
                        placeholder={t.placeholder}
                        separator={t.separator}
                    />
                    <MetricTile
                        label={t.metricRespRate}
                        value={metrics === null ? null : metrics.rr}
                        unit={t.metricRespRateUnit}
                        note={t.metricRespRateNote}
                        placeholder={t.placeholder}
                        separator={t.separator}
                    />
                </section>

                <div style={controlsStyle}>
                    {state.phase === "idle" && (
                        <button
                            type="button"
                            onClick={actions.startDemo}
                            style={secondaryButtonStyle}
                        >
                            {t.demoButton}
                        </button>
                    )}
                    {state.phase === "complete" && (
                        <button
                            type="button"
                            onClick={actions.reset}
                            style={primaryButtonStyle}
                        >
                            {t.newScanButton}
                        </button>
                    )}
                </div>

                {state.phase === "complete" && triage !== null && (
                    <GuidanceCard
                        t={t}
                        triage={triage}
                        locale={locale}
                        onSetLocale={handleSetLocale}
                    />
                )}

                <HistoryList history={history} t={t} onClear={handleClearHistory} />

                <footer style={footerStyle}>{t.disclaimer}</footer>
            </div>
        </div>
    );
}

// ---------- sub-components (all copy comes from translations.ts) ----------

interface MetricTileProps {
    label: string;
    value: number | null;
    unit: string;
    note: string | null;
    placeholder: string;
    separator: string;
}

function MetricTile({ label, value, unit, note, placeholder, separator }: MetricTileProps) {
    return (
        <div style={metricTileStyle}>
            <div style={metricLabelStyle}>{label}</div>
            <div style={metricValueStyle}>
                {value === null ? placeholder : Math.round(value)}
            </div>
            <div style={metricUnitStyle}>
                {unit}
                {note !== null ? `${separator}${note}` : null}
            </div>
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
        <div style={permissionFallbackStyle}>
            <h2 style={sectionTitleStyle}>
                {unsupported ? t.permissionUnsupportedTitle : t.permissionDeniedTitle}
            </h2>
            <p style={mutedStyle}>
                {unsupported ? t.permissionUnsupportedBody : t.permissionDeniedBody}
            </p>
            {!unsupported && (
                <button type="button" onClick={onGrant} style={primaryButtonStyle}>
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
    return (
        <section style={guidanceCardStyle}>
            <div style={guidanceHeaderStyle}>
                <h2 style={sectionTitleStyle}>{t.guidanceTitle}</h2>
                <div style={localeToggleStyle}>
                    <span style={localeToggleLabelStyle}>{t.languageLabel}</span>
                    <button
                        type="button"
                        style={locale === "en" ? localeActiveStyle : localeInactiveStyle}
                        aria-pressed={locale === "en"}
                        onClick={() => onSetLocale("en")}
                    >
                        {t.localeNameEn}
                    </button>
                    <button
                        type="button"
                        style={locale === "hi" ? localeActiveStyle : localeInactiveStyle}
                        aria-pressed={locale === "hi"}
                        onClick={() => onSetLocale("hi")}
                    >
                        {t.localeNameHi}
                    </button>
                </div>
            </div>
            <p style={mutedStyle}>{t.guidanceIntro}</p>
            <h3 style={{ ...triageHeadingStyle, color: headingColor }}>{branch.title}</h3>
            <p style={guidanceBodyStyle}>{branch.body}</p>
            {triage.referral && (
                <div style={referralBoxStyle}>
                    {triage.urgent && (
                        <strong style={urgentTextStyle}>{t.guidance.urgentPrefix}</strong>
                    )}
                    <span>{t.guidance.referralLine}</span>
                </div>
            )}
        </section>
    );
}

interface HistoryListProps {
    history: ScanRecord[];
    t: Strings;
    onClear: () => void;
}

function HistoryList({ history, t, onClear }: HistoryListProps) {
    return (
        <section style={historySectionStyle}>
            <div style={historyHeaderStyle}>
                <h2 style={sectionTitleStyle}>{t.historyTitle}</h2>
                {history.length > 0 && (
                    <button type="button" onClick={onClear} style={linkButtonStyle}>
                        {t.clearHistoryButton}
                    </button>
                )}
            </div>
            {history.length === 0 ? (
                <p style={mutedStyle}>{t.historyEmpty}</p>
            ) : (
                <ul style={historyListStyle}>
                    {history.map((record) => (
                        <li
                            key={record.id}
                            style={
                                record.mode === "demo" ? historyDemoRowStyle : historyLiveRowStyle
                            }
                        >
                            <div style={historyRowTopStyle}>
                                <span style={mutedStyle}>
                                    {formatTimestamp(record.timestamp, record.locale)}
                                </span>
                                <span
                                    style={
                                        record.mode === "demo" ? demoBadgeStyle : liveBadgeStyle
                                    }
                                >
                                    {record.mode === "demo" ? t.simulatedBadge : t.liveBadge}
                                </span>
                            </div>
                            <div style={historyMetricsStyle}>
                                {`${t.metricHeartRate}: ${record.bpm ?? t.placeholder} ${t.metricHeartRateUnit}${t.separator}${t.metricSpo2}: ${record.spo2 ?? t.placeholder}${t.metricSpo2Unit}${t.separator}${t.metricRespRate}: ${record.rr ?? t.placeholder} ${t.metricRespRateUnit}`}
                            </div>
                            <div style={mutedStyle}>
                                {t.guidance.triage[record.triageLevel].title}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function formatTimestamp(timestamp: number, locale: Locale): string {
    const localeTag = locale === "hi" ? "hi-IN" : "en-IN";
    return new Date(timestamp).toLocaleString(localeTag);
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
const badgeBase: CSSProperties = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
};
const liveBadgeStyle: CSSProperties = {
    ...badgeBase,
    background: "rgba(52,211,153,0.15)",
    color: "#34d399",
    border: "1px solid rgba(52,211,153,0.4)",
};
const demoBadgeStyle: CSSProperties = {
    ...badgeBase,
    background: "rgba(251,191,36,0.15)",
    color: "#fbbf24",
    border: "1px dashed rgba(251,191,36,0.6)",
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
    height: 280,
    objectFit: "cover",
    background: "#000",
};
const videoDimStyle: CSSProperties = { ...videoStyle, opacity: 0.2 };
const ppgCanvasStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "100%",
    height: 96,
    background: "rgba(2,6,23,0.55)",
    borderTop: "1px solid rgba(148,163,184,0.2)",
};
const contactOverlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
    background: "rgba(127,29,29,0.55)",
    color: "#fecaca",
    fontWeight: 600,
    fontSize: 16,
};
const demoBannerStyle: CSSProperties = {
    position: "absolute",
    top: 12,
    left: 12,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#fbbf24",
    color: "#451a03",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 0.5,
};
const permissionFallbackStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
    textAlign: "center",
    background: "rgba(2,6,23,0.88)",
};
const progressRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const progressTrackStyle: CSSProperties = {
    height: 8,
    borderRadius: 999,
    background: "#1e293b",
    overflow: "hidden",
    flex: 1,
};
const progressFillStyle: CSSProperties = {
    height: "100%",
    background: "#34d399",
    width: 0,
    transition: "width 0.4s linear",
};
const progressLabelStyle: CSSProperties = {
    fontSize: 13,
    color: "#94a3b8",
    whiteSpace: "nowrap",
};
const metricsGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
};
const metricTileStyle: CSSProperties = {
    background: "#111a2e",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: "14px 16px",
    textAlign: "center",
};
const metricLabelStyle: CSSProperties = { fontSize: 12, color: "#94a3b8", letterSpacing: 0.3 };
const metricValueStyle: CSSProperties = {
    fontSize: 34,
    fontWeight: 700,
    margin: "6px 0 2px",
    color: "#f1f5f9",
    fontVariantNumeric: "tabular-nums",
};
const metricUnitStyle: CSSProperties = { fontSize: 11, color: "#64748b" };
const controlsStyle: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };
const primaryButtonStyle: CSSProperties = {
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "#34d399",
    color: "#052e21",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
};
const secondaryButtonStyle: CSSProperties = {
    padding: "12px 18px",
    borderRadius: 10,
    background: "transparent",
    color: "#cbd5e1",
    border: "1px dashed #475569",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
};
const linkButtonStyle: CSSProperties = {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 12,
    cursor: "pointer",
    textDecoration: "underline",
};
const watermarkStyle: CSSProperties = {
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(251,191,36,0.12)",
    border: "1px dashed #fbbf24",
    color: "#fbbf24",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.5,
};
const guidanceCardStyle: CSSProperties = {
    background: "#111a2e",
    border: "1px solid #27354f",
    borderRadius: 14,
    padding: 18,
};
const guidanceHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
};
const sectionTitleStyle: CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "#f1f5f9",
};
const localeToggleStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const localeToggleLabelStyle: CSSProperties = { fontSize: 12, color: "#94a3b8" };
const localeActiveStyle: CSSProperties = {
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid #34d399",
    background: "rgba(52,211,153,0.15)",
    color: "#34d399",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
};
const localeInactiveStyle: CSSProperties = {
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "transparent",
    color: "#94a3b8",
    fontSize: 12,
    cursor: "pointer",
};
const triageHeadingStyle: CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    margin: "14px 0 6px",
};
const guidanceBodyStyle: CSSProperties = {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: "#cbd5e1",
};
const referralBoxStyle: CSSProperties = {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 10,
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.35)",
    fontSize: 14,
    lineHeight: 1.5,
    color: "#fecaca",
};
const urgentTextStyle: CSSProperties = { color: "#f87171" };
const historySectionStyle: CSSProperties = {
    background: "#0d1526",
    border: "1px solid #1e293b",
    borderRadius: 14,
    padding: 16,
};
const historyHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
};
const historyListStyle: CSSProperties = {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
};
const historyLiveRowStyle: CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#111a2e",
    border: "1px solid #1e293b",
};
const historyDemoRowStyle: CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(251,191,36,0.06)",
    border: "1px dashed #f59e0b",
};
const historyRowTopStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
};
const historyMetricsStyle: CSSProperties = { fontSize: 13, color: "#cbd5e1", marginBottom: 2 };
const mutedStyle: CSSProperties = { color: "#94a3b8", fontSize: 13, margin: 0 };
const footerStyle: CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
};