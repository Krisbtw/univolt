import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import QRCode from "qrcode";
import { Link } from "@tanstack/react-router";
import { evaluateFusion } from "../lib/fusionEngine";
import { useFusionSession } from "../lib/fusionStore";
import {
  buildSlipPayload,
  decodeSlipPayload,
  payloadByteLength,
  type SlipPayload,
} from "../lib/referralSlip";
import { makeId } from "../lib/vitalsDatabase";

// ── Session ID (stable for the lifetime of this component mount) ─────────────
const SESSION_ID = makeId();

// ── Level display helpers ─────────────────────────────────────────────────────

const LEVEL_META: Record<string, { label: string; color: string; emoji: string }> = {
  urgent:            { label: "URGENT — Go now",       color: "#f87171", emoji: "🚨" },
  phc_today:         { label: "Visit PHC today",       color: "#fbbf24", emoji: "⚠️" },
  self_care:         { label: "Self-care at home",     color: "#4ade80", emoji: "✅" },
  insufficient_data: { label: "Insufficient data",     color: "#94a3b8", emoji: "ℹ️" },
};

const REASON_LABELS: Record<string, string> = {
  bpm_extreme:       "HR > 150 bpm",
  shock_pattern:     "Fast HR + prolonged CRT",
  chest_pain:        "Chest pain",
  fainting:          "Fainting",
  bleeding:          "Active bleeding",
  fet_obstruction:   "FET > 6 s (airway obstruction)",
  tachycardia:       "HR > 100 bpm",
  bradycardia:       "HR < 50 bpm",
  tachypnea:         "RR > 24 /min",
  crt_elevated:      "CRT 3–5 s",
  pregnant_abnormal: "Pregnancy + abnormal signal",
  fever_3d:          "Fever ≥ 3 days",
  breathless:        "Breathlessness",
  all_normal:        "All signals in normal range",
};

function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ── QR + Card ─────────────────────────────────────────────────────────────────

export function ReferralScreen() {
  const session = useFusionSession();
  const fusion = useMemo(() => evaluateFusion(session), [session]);
  const [scanMode, setScanMode] = useState(false);
  const [decoded, setDecoded] = useState<SlipPayload | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // QR canvas ref
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Print card ref
  const cardRef = useRef<HTMLDivElement | null>(null);

  const hasData = fusion.signalsUsed > 0 || (session.symptoms && Object.values(session.symptoms).some(Boolean));

  const payload = useMemo(() => {
    if (!hasData) return null;
    return buildSlipPayload(session, fusion.level, fusion.reasons, SESSION_ID);
  }, [session, fusion, hasData]);

  const payloadJson = payload ? JSON.stringify(payload) : null;
  const byteLen = payload ? payloadByteLength(payload) : 0;

  // Render QR code onto canvas whenever payload changes
  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !payloadJson) return;
    QRCode.toCanvas(canvas, payloadJson, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
    }).catch((err) => console.warn("[QR] render error:", err));
  }, [payloadJson]);

  // ── Download PNG ──────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `univolt-referral-${payload?.id ?? "slip"}.png`;
    link.click();
  }, [payload]);

  // ── Print ─────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ── Scan mode (BarcodeDetector) ───────────────────────────────────────────

  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barcodeDetectorRef = useRef<BarcodeDetector | null>(null);

  const stopScan = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (scanStreamRef.current) { scanStreamRef.current.getTracks().forEach(t => t.stop()); scanStreamRef.current = null; }
    if (scanVideoRef.current) scanVideoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  const startScan = useCallback(async () => {
    if (!("BarcodeDetector" in window)) {
      setScanError("unsupported");
      return;
    }
    setScanError(null);
    setDecoded(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = stream;
        scanVideoRef.current.play().catch(() => {});
      }
      barcodeDetectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      scanIntervalRef.current = setInterval(async () => {
        const video = scanVideoRef.current;
        const detector = barcodeDetectorRef.current;
        if (!video || !detector || video.readyState < 2) return;
        try {
          const barcodes = await detector.detect(video);
          for (const barcode of barcodes) {
            if (barcode.rawValue) {
              const result = decodeSlipPayload(barcode.rawValue);
              if (result) {
                setDecoded(result);
                stopScan();
                setScanMode(false);
              }
            }
          }
        } catch {
          // ignore per-frame errors
        }
      }, 500);
    } catch {
      setScanError("camera_denied");
    }
  }, [stopScan]);

  const lm = payload ? LEVEL_META[fusion.level]! : null;

  return (
    <div style={screenStyle}>
      <style>{PRINT_CSS}</style>
      <div style={wrapStyle}>
        {/* Header */}
        <div style={headerRowStyle}>
          <h1 style={titleStyle}>📋 Referral Slip</h1>
          <Link to={"/fusion" as any} style={navLinkStyle}>← Triage</Link>
        </div>

        {/* No data */}
        {!hasData && (
          <div style={noDataCardStyle}>
            <p style={noDataTextStyle}>
              ℹ️ Complete at least one test (rPPG scan, FET, or CRT) before generating a referral.
            </p>
            <Link to={("/scan") as any} style={ctaLinkStyle}>Go to vitals scan →</Link>
          </div>
        )}

        {/* Referral card (printable) */}
        {hasData && payload && lm && (
          <>
            <div ref={cardRef} id="referral-card" style={cardStyle}>
              {/* Level header */}
              <div style={{ ...levelBannerStyle, background: lm.color + "18", border: `1px solid ${lm.color}44` }}>
                <span style={{ fontSize: 28 }}>{lm.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: lm.color }}>{lm.label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                    Case {payload.id} · {fmtTime(payload.ts)}
                  </p>
                </div>
              </div>

              {/* Vitals */}
              <div style={cardSectionStyle}>
                <p style={cardHeadStyle}>Vitals</p>
                <div style={vitalsGridStyle}>
                  {payload.bpm != null && <VitalChip label="HR" value={`${payload.bpm} bpm`} />}
                  {payload.rr  != null && <VitalChip label="RR" value={`${payload.rr} /min`} />}
                  {payload.crt != null && <VitalChip label="CRT" value={`${payload.crt} s`} />}
                  {payload.fet != null && <VitalChip label="FET" value={`${payload.fet} s`} />}
                  {payload.age != null && <VitalChip label="Age" value={`${payload.age} yr`} />}
                  {payload.preg && <VitalChip label="Preg" value="Yes" />}
                </div>
              </div>

              {/* Reasons */}
              {payload.rsn.length > 0 && (
                <div style={cardSectionStyle}>
                  <p style={cardHeadStyle}>Clinical reasons</p>
                  <ul style={reasonListStyle}>
                    {payload.rsn.map(r => (
                      <li key={r} style={reasonItemStyle}>• {reasonLabel(r)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* QR */}
              <div style={qrWrapStyle}>
                <canvas ref={qrCanvasRef} style={{ borderRadius: 8 }} />
                <p style={qrNoteStyle}>{byteLen} bytes · scan at PHC to decode</p>
              </div>

              <p style={cardDisclaimerStyle}>
                Not a medical device. For screening only — confirm at the PHC with clinical assessment.
                No personal identifying data stored.
              </p>
            </div>

            {/* Action buttons */}
            <div style={actionRowStyle}>
              <button id="btn-referral-print" style={primaryBtnStyle} onClick={handlePrint}>🖨️ Print slip</button>
              <button id="btn-referral-download" style={secondaryBtnStyle} onClick={handleDownload}>⬇️ Download PNG</button>
              <button
                id="btn-referral-scan"
                style={secondaryBtnStyle}
                onClick={() => { setScanMode(!scanMode); if (!scanMode) startScan(); else stopScan(); }}
              >
                📷 Scan QR code
              </button>
            </div>
          </>
        )}

        {/* Scan mode */}
        {scanMode && (
          <div style={scanCardStyle}>
            <p style={scanInstructStyle}>Point camera at patient's referral QR code to decode it.</p>
            {scanError === "unsupported" && (
              <p style={{ color: "#fbbf24", fontSize: 13 }}>
                QR scanning is not supported in this browser. Use your camera app to scan instead.
              </p>
            )}
            {scanError === "camera_denied" && (
              <p style={{ color: "#f87171", fontSize: 13 }}>Camera access denied. Please grant permission.</p>
            )}
            <video ref={scanVideoRef} autoPlay playsInline muted style={scanVideoStyle} />
            <button style={secondaryBtnStyle} onClick={() => { stopScan(); setScanMode(false); }}>Cancel</button>
          </div>
        )}

        {/* Decoded handoff card */}
        {decoded && (
          <div style={decodedCardStyle}>
            <p style={cardHeadStyle}>📋 Patient Handoff Card</p>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
              Case {decoded.id} · {fmtTime(decoded.ts)}
            </p>
            <div style={{ ...levelBannerStyle, background: LEVEL_META[decoded.lvl]!.color + "18", border: `1px solid ${LEVEL_META[decoded.lvl]!.color}44`, marginTop: 10 }}>
              <span style={{ fontSize: 24 }}>{LEVEL_META[decoded.lvl]!.emoji}</span>
              <p style={{ margin: 0, fontWeight: 700, color: LEVEL_META[decoded.lvl]!.color }}>
                {LEVEL_META[decoded.lvl]!.label}
              </p>
            </div>
            <div style={vitalsGridStyle}>
              {decoded.bpm != null && <VitalChip label="HR"  value={`${decoded.bpm} bpm`} />}
              {decoded.rr  != null && <VitalChip label="RR"  value={`${decoded.rr} /min`} />}
              {decoded.crt != null && <VitalChip label="CRT" value={`${decoded.crt} s`} />}
              {decoded.fet != null && <VitalChip label="FET" value={`${decoded.fet} s`} />}
              {decoded.age != null && <VitalChip label="Age" value={`${decoded.age} yr`} />}
              {decoded.preg && <VitalChip label="Preg" value="Yes" />}
            </div>
            {decoded.rsn.length > 0 && (
              <ul style={reasonListStyle}>
                {decoded.rsn.map(r => <li key={r} style={reasonItemStyle}>• {reasonLabel(r)}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={vitalChipStyle}>
      <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{value}</span>
    </div>
  );
}

// ── Print CSS ─────────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body > * { display: none !important; }
  #referral-card { display: block !important; color: #000 !important; background: #fff !important; }
  button, a, video { display: none !important; }
}
`;

// ── Styles ────────────────────────────────────────────────────────────────────

const screenStyle: CSSProperties = { minHeight: "100vh", background: "#0b1120", color: "#e2e8f0", fontFamily: 'system-ui,"Segoe UI",sans-serif', padding: "20px 16px 48px", boxSizing: "border-box" };
const wrapStyle: CSSProperties = { maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 };
const headerRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 };
const titleStyle: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700 };
const navLinkStyle: CSSProperties = { color: "#34d399", fontSize: 13, textDecoration: "none" };
const noDataCardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "18px", display: "flex", flexDirection: "column", gap: 12 };
const noDataTextStyle: CSSProperties = { margin: 0, fontSize: 14, color: "#94a3b8" };
const ctaLinkStyle: CSSProperties = { background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" };
const cardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "20px", display: "flex", flexDirection: "column", gap: 14 };
const levelBannerStyle: CSSProperties = { borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 };
const cardSectionStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const cardHeadStyle: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" };
const vitalsGridStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const vitalChipStyle: CSSProperties = { background: "#020617", border: "1px solid #1e293b", borderRadius: 8, padding: "7px 12px", display: "flex", flexDirection: "column", gap: 2, minWidth: 70 };
const reasonListStyle: CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 };
const reasonItemStyle: CSSProperties = { fontSize: 13, color: "#cbd5e1" };
const qrWrapStyle: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 };
const qrNoteStyle: CSSProperties = { margin: 0, fontSize: 11, color: "#475569" };
const cardDisclaimerStyle: CSSProperties = { margin: 0, fontSize: 10, color: "#475569", textAlign: "center" };
const actionRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10 };
const primaryBtnStyle: CSSProperties = { flex: 1, minWidth: 140, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", borderRadius: 12, padding: "13px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const secondaryBtnStyle: CSSProperties = { flex: 1, minWidth: 120, background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 12, padding: "13px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const scanCardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 12 };
const scanInstructStyle: CSSProperties = { margin: 0, fontSize: 14, color: "#e2e8f0" };
const scanVideoStyle: CSSProperties = { width: "100%", borderRadius: 8, background: "#000" };
const decodedCardStyle: CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 };
