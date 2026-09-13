import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import QRCode from "qrcode";
import { Link } from "@tanstack/react-router";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { evaluateFusion, type FusionLevel, type FusionInputs } from "../lib/fusionEngine";
import { useFusionSession } from "../lib/fusionStore";
import {
  buildSlipPayload,
  decodeSlipPayload,
  payloadByteLength,
  type SlipPayload,
} from "../lib/referralSlip";
import { makeId } from "../lib/vitalsDatabase";
import { selectPatient, selectScans, useUnivolt } from "@/lib/univolt/store";

// ── Session ID (stable for the lifetime of this component mount) ─────────────
const SESSION_ID = makeId();

// ── Level display helpers ─────────────────────────────────────────────────────

const LEVEL_META: Record<
  string,
  { label: string; bgClass: string; textClass: string; borderClass: string; emoji: string }
> = {
  urgent: {
    label: "URGENT — Hospital / Emergency",
    bgClass: "bg-red-500/10",
    textClass: "text-red-700 dark:text-red-400",
    borderClass: "border-red-500/30",
    emoji: "🚨",
  },
  phc_today: {
    label: "Visit PHC Today",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-800 dark:text-amber-400",
    borderClass: "border-amber-500/30",
    emoji: "⚠️",
  },
  self_care: {
    label: "Routine / Self-Care at Home",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-800 dark:text-emerald-400",
    borderClass: "border-emerald-500/30",
    emoji: "✅",
  },
  insufficient_data: {
    label: "Insufficient Data",
    bgClass: "bg-surface",
    textClass: "text-muted",
    borderClass: "border-line",
    emoji: "ℹ️",
  },
};

const REASON_LABELS: Record<string, string> = {
  bpm_extreme: "HR > 150 bpm",
  shock_pattern: "Fast HR + prolonged CRT",
  chest_pain: "Chest pain",
  fainting: "Fainting",
  bleeding: "Active bleeding",
  fet_obstruction: "FET > 6 s (airway obstruction)",
  tachycardia: "HR > 100 bpm",
  bradycardia: "HR < 50 bpm",
  tachypnea: "RR > 24 /min",
  crt_elevated: "CRT 3–5 s",
  pregnant_abnormal: "Pregnancy + abnormal signal",
  fever_3d: "Fever ≥ 3 days",
  breathless: "Breathlessness",
  all_normal: "All signals in normal range",
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
  const db = useUnivolt((s) => s.db);

  // Check URL search for patientId (e.g. from patient profile link)
  const patientId = useMemo(() => {
    try {
      if (typeof window === "undefined") return undefined;
      return new URLSearchParams(window.location.search).get("patientId") || undefined;
    } catch {
      return undefined;
    }
  }, []);

  const patient = useMemo(() => {
    return patientId ? selectPatient(db, patientId) : null;
  }, [db, patientId]);

  const patientScans = useMemo(() => {
    return patient ? selectScans(db, patient.id) : [];
  }, [db, patient]);

  // Combine session or patient data into fusion inputs
  const fusionInputs = useMemo((): FusionInputs => {
    if (!patient) return session;

    const cameraScans = patientScans.filter((s) => s.source !== "manual");
    const manualScans = patientScans.filter((s) => s.source === "manual");
    const lastScan = cameraScans[cameraScans.length - 1] ?? null;
    const lastManualScan = manualScans[manualScans.length - 1] ?? null;
    const cameraSpo2 =
      lastScan?.spo2Quality === "good" || lastScan?.spo2Quality === "weak"
        ? lastScan.spo2Estimate
        : null;
    const latestSpo2 = cameraSpo2 ?? lastManualScan?.spo2Estimate ?? null;

    return {
      ...session,
      ageYears: session.ageYears ?? patient.age,
      rppg:
        session.rppg ??
        (lastScan
          ? {
              bpm: lastScan.heartRate,
              rr: lastScan.respiratoryRate,
              hrv: lastScan.hrvRmssd,
              quality: (lastScan.signalQuality > 50 ? "good" : "weak") as "good" | "weak",
            }
          : undefined),
      spo2:
        session.spo2 ??
        (latestSpo2 != null
          ? {
              value: latestSpo2,
              quality: (lastScan?.spo2Quality ?? "good") as
                | "good"
                | "weak"
                | "reject"
                | "manual",
            }
          : undefined),
    };
  }, [session, patient, patientScans]);

  const fusion = useMemo(() => evaluateFusion(fusionInputs), [fusionInputs]);
  const [scanMode, setScanMode] = useState(false);
  const [decoded, setDecoded] = useState<SlipPayload | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // QR canvas ref
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Print card ref
  const cardRef = useRef<HTMLDivElement | null>(null);

  const hasData =
    fusion.signalsUsed > 0 ||
    Boolean(fusionInputs.symptoms && Object.values(fusionInputs.symptoms).some(Boolean)) ||
    fusion.reasons.length > 0;

  const payload = useMemo(() => {
    if (!hasData) return null;
    return buildSlipPayload(fusionInputs, fusion.level, fusion.reasons, SESSION_ID);
  }, [fusionInputs, fusion, hasData]);

  const payloadJson = payload ? JSON.stringify(payload) : null;
  const byteLen = payload ? payloadByteLength(payload) : 0;

  // Render QR code onto canvas whenever payload changes
  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !payloadJson) return;
    QRCode.toCanvas(canvas, payloadJson, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: {
        dark: "#145c4c",
        light: "#ffffff",
      },
    }).catch((err) => console.warn("[QR] render error:", err));
  }, [payloadJson]);

  // ── Download PNG ──────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `unicare-referral-${payload?.id ?? "slip"}.png`;
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
  const barcodeDetectorRef = useRef<any | null>(null);

  const stopScan = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((t) => t.stop());
      scanStreamRef.current = null;
    }
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = stream;
        scanVideoRef.current.play().catch(() => {});
      }
      const DetectorClass = (window as any).BarcodeDetector;
      barcodeDetectorRef.current = new DetectorClass({ formats: ["qr_code"] });
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

  const lm = payload ? LEVEL_META[fusion.level] ?? LEVEL_META.insufficient_data : null;

  return (
    <AppFrame>
      <style>{PRINT_CSS}</style>
      <AppHeader
        back={
          patientId
            ? { to: "/patient/$id", params: { id: patientId } }
            : { to: "/" }
        }
        title="Referral Slip"
        subtitle="Offline QR clinical handoff"
      />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-4">
        {/* No data state */}
        {!hasData && (
          <div className="rounded-[24px] border border-line bg-paper p-6 text-center flex flex-col items-center gap-3">
            <div className="size-12 rounded-full bg-surface flex items-center justify-center text-xl">
              ℹ️
            </div>
            <h2 className="font-display text-base font-semibold text-ink">
              No Triage Signals Recorded
            </h2>
            <p className="text-xs text-muted leading-relaxed max-w-[280px]">
              Complete at least one vital scan, breathing test, or select an existing patient to generate an offline referral slip.
            </p>
            <div className="flex flex-col gap-2 w-full pt-2">
              <Link to="/scan" className="w-full">
                <Button className="w-full" variant="default">
                  📹 Go to Vitals Scan
                </Button>
              </Link>
              <Link to="/" className="w-full">
                <Button className="w-full" variant="secondary">
                  👥 View Patient Roster
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Printable referral card */}
        {hasData && payload && lm && (
          <>
            <div
              ref={cardRef}
              id="referral-card"
              className="rounded-[24px] border border-line bg-paper p-5 shadow-sm flex flex-col gap-4 text-ink"
            >
              {/* Level banner */}
              <div
                className={`flex items-center gap-3.5 rounded-[16px] p-3.5 border ${lm.bgClass} ${lm.borderClass} ${lm.textClass}`}
              >
                <span className="text-3xl leading-none">{lm.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-base font-bold leading-tight">
                      {lm.label}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-paper/80 border border-current/20">
                      Case {payload.id}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Issued {fmtTime(payload.ts)}
                  </p>
                </div>
              </div>

              {/* Patient info if linked */}
              {patient && (
                <div className="rounded-[16px] border border-line bg-surface/60 p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-ink">{patient.name}</p>
                    <p className="text-[11px] text-muted">
                      {patient.age}y · {patient.sex === "F" ? "Female" : patient.sex === "M" ? "Male" : "Other"} {patient.village ? `· ${patient.village}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted bg-paper px-2 py-1 rounded-[8px] border border-line">
                    {patient.caseId}
                  </span>
                </div>
              )}

              {/* Vitals summary */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  Recorded Vitals
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {payload.bpm != null && (
                    <VitalChip label="HR" value={`${payload.bpm} bpm`} />
                  )}
                  {payload.rr != null && (
                    <VitalChip label="RR" value={`${payload.rr} /min`} />
                  )}
                  {fusionInputs.spo2?.value != null && (
                    <VitalChip label="SpO₂" value={`${fusionInputs.spo2.value}%`} />
                  )}
                  {payload.crt != null && (
                    <VitalChip label="CRT" value={`${payload.crt} s`} />
                  )}
                  {payload.fet != null && (
                    <VitalChip label="FET" value={`${payload.fet} s`} />
                  )}
                  {payload.age != null && (
                    <VitalChip label="Age" value={`${payload.age} yr`} />
                  )}
                  {payload.preg && (
                    <VitalChip label="Pregnancy" value="Yes" />
                  )}
                </div>
              </div>

              {/* Clinical reasons */}
              {payload.rsn.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                    Clinical Reasons
                  </p>
                  <ul className="flex flex-col gap-1.5 rounded-[16px] border border-line bg-surface/50 p-3">
                    {payload.rsn.map((r) => (
                      <li key={r} className="flex items-center gap-2 text-xs font-medium text-ink">
                        <span className="size-1.5 rounded-full bg-pine shrink-0" />
                        {reasonLabel(r)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2 pt-2 border-t border-line/60">
                <div className="p-3 bg-white rounded-[16px] border border-line/80 shadow-inner">
                  <canvas ref={qrCanvasRef} className="block size-[220px]" />
                </div>
                <p className="text-[11px] text-muted text-center font-medium">
                  {byteLen} bytes · Scan at Primary Health Centre (PHC) to import
                </p>
              </div>

              <p className="text-[10px] text-muted text-center leading-relaxed">
                Not a medical diagnosis device. For field screening & referral handoff only. Confirm at the PHC with full clinical assessment.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  id="btn-referral-print"
                  variant="default"
                  onClick={handlePrint}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  🖨️ Print Slip
                </Button>
                <Button
                  id="btn-referral-download"
                  variant="secondary"
                  onClick={handleDownload}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  ⬇️ Save PNG
                </Button>
              </div>
              <Button
                id="btn-referral-scan"
                variant="outline"
                onClick={() => {
                  setScanMode(!scanMode);
                  if (!scanMode) startScan();
                  else stopScan();
                }}
                className="w-full gap-1.5 text-xs font-semibold"
              >
                📷 {scanMode ? "Close Scanner" : "Scan Patient QR Code"}
              </Button>
            </div>

            {/* Navigation links */}
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <Link
                to="/schemes"
                className="text-xs font-semibold text-pine hover:underline"
              >
                See applicable government health schemes →
              </Link>
              <Link
                to="/fusion"
                className="text-xs font-medium text-muted hover:text-ink"
              >
                ← Triage Questionnaire & Multimodal Tests
              </Link>
            </div>
          </>
        )}

        {/* Scan mode camera view */}
        {scanMode && (
          <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-3">
            <p className="text-xs font-medium text-ink">
              Point camera at patient's referral QR code to decode it.
            </p>
            {scanError === "unsupported" && (
              <p className="text-xs text-amber-600 bg-amber-500/10 p-2.5 rounded-[10px] border border-amber-500/20">
                QR scanning is not supported in this browser. Use your camera app to scan instead.
              </p>
            )}
            {scanError === "camera_denied" && (
              <p className="text-xs text-red-600 bg-red-500/10 p-2.5 rounded-[10px] border border-red-500/20">
                Camera access denied. Please grant permission in your browser settings.
              </p>
            )}
            <video
              ref={scanVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-[4/3] rounded-[14px] bg-black object-cover"
            />
            <Button
              variant="secondary"
              onClick={() => {
                stopScan();
                setScanMode(false);
              }}
              className="w-full text-xs"
            >
              Cancel Scan
            </Button>
          </div>
        )}

        {/* Decoded QR handoff card */}
        {decoded && (
          <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-3 text-ink">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                📋 Decoded Handoff Card
              </p>
              <span className="text-[10px] text-muted font-medium">
                Case {decoded.id} · {fmtTime(decoded.ts)}
              </span>
            </div>

            {(() => {
              const dlm = LEVEL_META[decoded.lvl] ?? LEVEL_META.insufficient_data;
              return (
                <div
                  className={`flex items-center gap-3 rounded-[12px] p-3 border ${dlm.bgClass} ${dlm.borderClass} ${dlm.textClass}`}
                >
                  <span className="text-2xl">{dlm.emoji}</span>
                  <p className="text-sm font-bold">{dlm.label}</p>
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-2">
              {decoded.bpm != null && <VitalChip label="HR" value={`${decoded.bpm} bpm`} />}
              {decoded.rr != null && <VitalChip label="RR" value={`${decoded.rr} /min`} />}
              {decoded.crt != null && <VitalChip label="CRT" value={`${decoded.crt} s`} />}
              {decoded.fet != null && <VitalChip label="FET" value={`${decoded.fet} s`} />}
              {decoded.age != null && <VitalChip label="Age" value={`${decoded.age} yr`} />}
              {decoded.preg && <VitalChip label="Preg" value="Yes" />}
            </div>

            {decoded.rsn.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface/50 p-2.5">
                {decoded.rsn.map((r) => (
                  <li key={r} className="text-xs text-muted flex items-center gap-1.5">
                    <span className="size-1 rounded-full bg-pine shrink-0" />
                    {reasonLabel(r)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </AppFrame>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-surface p-2 flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="text-xs font-bold text-ink">{value}</span>
    </div>
  );
}

// ── Print CSS ─────────────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body {
    background: #ffffff !important;
    color: #000000 !important;
  }
  header, button, a, video, [data-preview-host] {
    display: none !important;
  }
  #referral-card {
    display: block !important;
    max-width: 480px !important;
    margin: 0 auto !important;
    padding: 16px !important;
    background: #ffffff !important;
    color: #000000 !important;
    border: 1px solid #cccccc !important;
    box-shadow: none !important;
  }
  #referral-card * {
    color: #000000 !important;
    background-color: transparent !important;
  }
}
`;
