/**
 * EmergencyCardScreen — wallet-style emergency card with QR code.
 *
 * PRIVACY NOTICE (mandatory): The QR code generated here contains no name
 * or contact details — only the anonymized patient ID + clinical fields.
 * Anyone who scans the printed QR can view this data. That is intentional:
 * emergency responders need access without authentication.
 *
 * Do NOT add name, DOB, phone number, or location to the QR payload.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import QRCode from "qrcode";
import { format } from "date-fns";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  latestScan,
  selectPatient,
  selectScans,
  useUnivolt,
} from "@/lib/univolt/store";
import type { BloodGroup, Patient } from "@/lib/univolt/types";

export const Route = createFileRoute("/emergency/$id")({ component: EmergencyCardScreen });

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Compact QR payload.
 * Short keys keep the JSON ≤ 400 bytes.
 * ANYONE who scans the printed card can read this — no auth, by design.
 */
interface EmgPayload {
  v: 1;
  emg: true;
  /** Anonymized patient ID — NOT the patient's name. */
  id: string;
  bg?: string;
  alg?: string;
  cond?: string;
  med?: string;
  bpm?: number;
  rr?: number;
  /** SpO₂ from manual entry only — null if not measured. */
  spo2?: number;
  ts: number;
}

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];

// ── Payload helpers ────────────────────────────────────────────────────────────

function buildPayload(patient: Patient, bpm?: number, rr?: number, spo2?: number): EmgPayload {
  const p: EmgPayload = {
    v: 1,
    emg: true,
    id: patient.caseId, // anonymized ID only — no name
    ts: Math.floor(Date.now() / 1000),
  };
  if (patient.bloodGroup && patient.bloodGroup !== "unknown") p.bg = patient.bloodGroup;
  if (patient.allergies?.trim())         p.alg  = patient.allergies.trim().slice(0, 80);
  if (patient.conditions?.trim())        p.cond = patient.conditions.trim().slice(0, 80);
  if (patient.currentMedication?.trim()) p.med  = patient.currentMedication.trim().slice(0, 80);
  if (bpm  != null) p.bpm  = bpm;
  if (rr   != null) p.rr   = rr;
  if (spo2 != null) p.spo2 = spo2;
  return p;
}

function decodePayload(json: string): EmgPayload | null {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    if (obj["v"] !== 1 || obj["emg"] !== true) return null;
    if (typeof obj["id"] !== "string") return null;
    if (typeof obj["ts"] !== "number") return null;
    return obj as unknown as EmgPayload;
  } catch {
    return null;
  }
}

// ── Emergency View (shown when scanned) ───────────────────────────────────────

function EmergencyView({ p, onClose }: { p: EmgPayload; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-red-950 p-6">
      <button onClick={onClose} className="self-start text-red-200 text-sm font-medium">← Back</button>
      <div>
        <h1 className="font-display text-2xl font-bold text-red-200">⚠️ EMERGENCY INFORMATION</h1>
        <p className="mt-1 text-sm text-red-300">
          This data has no name attached. Responders: confirm identity through clinical staff.
        </p>
      </div>
      <div className="rounded-[16px] bg-red-900/60 border border-red-600/40 p-4 flex flex-col gap-3">
        <Field label="Case ID"       value={p.id} />
        <Field label="Blood Group"   value={p.bg ?? "Not recorded"} />
        <Field label="Allergies"     value={p.alg ?? "None on file"} />
        <Field label="Conditions"    value={p.cond ?? "None on file"} />
        <Field label="Medication"    value={p.med ?? "None on file"} />
      </div>
      {(p.bpm != null || p.rr != null || p.spo2 != null) && (
        <div className="rounded-[16px] bg-red-900/60 border border-red-600/40 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-red-300">Latest Vitals</p>
          <div className="grid grid-cols-3 gap-3">
            {p.bpm  != null && <BigStat label="HR"   value={`${p.bpm}`} unit="bpm" />}
            {p.rr   != null && <BigStat label="RR"   value={`${p.rr}`}  unit="/min" />}
            {p.spo2 != null && <BigStat label="SpO₂" value={`${p.spo2}`} unit="%" />}
          </div>
        </div>
      )}
      <p className="text-[10px] text-red-400 leading-relaxed">
        This QR contains no name or contact details. Anyone who scanned it can view this information —
        that is intentional so emergency responders can access it without authentication.
        Not a medical device.
      </p>
      <p className="text-[11px] text-red-300">Scanned at {format(Date.now(), "d MMM yyyy HH:mm")}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-red-100">{value}</p>
    </div>
  );
}

function BigStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-red-400 font-semibold uppercase">{label}</p>
      <p className="font-display text-2xl font-bold text-red-100">{value}</p>
      <p className="text-[10px] text-red-400">{unit}</p>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export function EmergencyCardScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const updatePatientMedical = useUnivolt((s) => s.updatePatientMedical);
  const patient = selectPatient(db, id);
  const scans = selectScans(db, id);

  // Latest camera scan for HR + RR
  const lastCam = scans.filter((s) => !s.source || s.source === "scan").at(-1) ?? null;
  // Latest manual SpO₂
  const lastManual = scans.filter((s) => s.source === "manual").at(-1) ?? null;

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Local editable state for medical fields
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(patient?.bloodGroup ?? "unknown");
  const [allergies, setAllergies] = useState(patient?.allergies ?? "");
  const [conditions, setConditions] = useState(patient?.conditions ?? "");
  const [medication, setMedication] = useState(patient?.currentMedication ?? "");
  const [editMode, setEditMode] = useState(false);
  const [saved, setSaved] = useState(false);

  // Scan mode
  const [scanMode, setScanMode] = useState(false);
  const [scannedPayload, setScannedPayload] = useState<EmgPayload | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);

  // Build and render QR whenever patient or vitals change
  const payload = patient
    ? buildPayload(
        { ...patient, bloodGroup, allergies, conditions, currentMedication: medication },
        lastCam?.heartRate,
        lastCam?.respiratoryRate,
        lastManual?.spo2Estimate ?? undefined,
      )
    : null;

  useEffect(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !payload) return;
    QRCode.toCanvas(canvas, JSON.stringify(payload), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
    }).catch((err) => console.warn("[QR] error:", err));
  }, [payload]);

  const handleSave = useCallback(() => {
    if (!patient) return;
    updatePatientMedical(patient.id, {
      bloodGroup,
      allergies: allergies.trim() || undefined,
      conditions: conditions.trim() || undefined,
      currentMedication: medication.trim() || undefined,
    });
    setEditMode(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [patient, bloodGroup, allergies, conditions, medication, updatePatientMedical]);

  const handleDownload = useCallback(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !patient) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `emergency-${patient.caseId}.png`;
    link.click();
  }, [patient]);

  const handlePrint = useCallback(() => window.print(), []);

  const stopScan = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (scanStreamRef.current) { scanStreamRef.current.getTracks().forEach((t) => t.stop()); scanStreamRef.current = null; }
    if (scanVideoRef.current) scanVideoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  const startScan = useCallback(async () => {
    if (!("BarcodeDetector" in window)) { setScanError("unsupported"); return; }
    setScanError(null);
    setScannedPayload(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) { scanVideoRef.current.srcObject = stream; scanVideoRef.current.play().catch(() => {}); }
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      scanIntervalRef.current = setInterval(async () => {
        const video = scanVideoRef.current;
        const det = detectorRef.current;
        if (!video || !det || video.readyState < 2) return;
        try {
          const barcodes = await det.detect(video);
          for (const bc of barcodes) {
            const result = decodePayload(bc.rawValue);
            if (result) { setScannedPayload(result); stopScan(); setScanMode(false); }
          }
        } catch { /* per-frame errors ignored */ }
      }, 500);
    } catch { setScanError("camera_denied"); }
  }, [stopScan]);

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
      </AppFrame>
    );
  }

  // Show the decoded emergency view full-screen
  if (scannedPayload) {
    return <EmergencyView p={scannedPayload} onClose={() => setScannedPayload(null)} />;
  }

  return (
    <AppFrame>
      <style>{PRINT_CSS}</style>
      <AppHeader back={{ to: "/patient/$id", params: { id } }} title="Emergency Card" />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">

        {/* Card */}
        <div id="emg-card" className="rounded-[20px] border border-red-400/30 bg-paper p-5">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-red-400 font-bold text-lg">⚠️</span>
            <h1 className="font-display text-lg font-bold text-red-400">EMERGENCY INFORMATION</h1>
          </div>
          <p className="mb-4 text-[11px] text-faint">
            Case {patient.caseId} — no name stored · Last updated {format(patient.lastVisitAt, "d MMM yyyy")}
          </p>

          {/* Medical fields */}
          {editMode ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted">Blood Group</label>
                <select
                  id="select-blood-group"
                  value={bloodGroup}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setBloodGroup(e.target.value as BloodGroup)}
                  className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none"
                >
                  {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              {[
                { id: "input-allergies",  label: "Allergies",           value: allergies,   setter: setAllergies },
                { id: "input-conditions", label: "Conditions",          value: conditions,  setter: setConditions },
                { id: "input-medication", label: "Current Medication",  value: medication,  setter: setMedication },
              ].map(({ id: fid, label, value, setter }) => (
                <div key={fid}>
                  <label className="text-[11px] font-medium text-muted">{label}</label>
                  <input
                    id={fid}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder="None"
                    className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-pine"
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <Button id="btn-emg-save" size="sm" onClick={handleSave}>{saved ? "Saved!" : "Save"}</Button>
                <Button id="btn-emg-cancel" size="sm" variant="secondary" onClick={() => setEditMode(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <InfoRow label="Blood Group" value={bloodGroup === "unknown" ? "Unknown" : (bloodGroup || "Unknown")} />
              <InfoRow label="Allergies"   value={allergies  || "None on file"} />
              <InfoRow label="Conditions"  value={conditions || "None on file"} />
              <InfoRow label="Medication"  value={medication || "None on file"} />
              <Button id="btn-emg-edit" size="sm" variant="secondary" className="mt-1 self-start" onClick={() => setEditMode(true)}>
                Edit emergency info
              </Button>
            </div>
          )}

          {/* Latest vitals */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Latest Vitals</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <VitalBox label="HR"   value={lastCam ? `${lastCam.heartRate}` : "--"} unit="bpm" />
              <VitalBox label="RR"   value={lastCam ? `${lastCam.respiratoryRate}` : "--"} unit="/min" />
              <VitalBox label="SpO₂" value={lastManual ? `${lastManual.spo2Estimate}` : "--"} unit={lastManual ? "%" : ""} />
            </div>
            {!lastManual && (
              <p className="mt-1 text-[10px] text-faint">SpO₂ not measured (camera only — enter manual reading on patient page)</p>
            )}
          </div>

          {/* QR */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <canvas ref={qrCanvasRef} className="rounded-[8px]" />
            <p className="text-[10px] text-faint text-center">
              Anyone who scans this QR can view the fields above.<br />
              No name or contact details are stored. By design.
            </p>
          </div>
        </div>

        {/* Disclaimer — must be visible */}
        <p className="px-1 text-[11px] text-faint leading-relaxed">
          This QR contains no name or contact details. Anyone who scans it can view this information —
          that is intentional so emergency responders can access it without authentication.
          Not a medical device.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button id="btn-emg-print"    size="sm" onClick={handlePrint}>🖨️ Print card</Button>
          <Button id="btn-emg-download" size="sm" variant="secondary" onClick={handleDownload}>⬇️ Download PNG</Button>
          <Button
            id="btn-emg-scan"
            size="sm"
            variant="secondary"
            onClick={() => { setScanMode(!scanMode); if (!scanMode) startScan(); else stopScan(); }}
          >
            📷 Scan emergency QR
          </Button>
        </div>

        {/* Scan mode */}
        {scanMode && (
          <div className="rounded-[16px] border border-line bg-paper p-4 flex flex-col gap-3">
            <p className="text-sm text-ink">Point camera at a printed emergency card QR code.</p>
            {scanError === "unsupported" && (
              <p className="text-sm text-amber-400">QR scanning is not supported in this browser. Use your camera app.</p>
            )}
            {scanError === "camera_denied" && (
              <p className="text-sm text-red-400">Camera access denied.</p>
            )}
            <video ref={scanVideoRef} autoPlay playsInline muted className="w-full rounded-[10px] bg-black" />
            <Button size="sm" variant="secondary" onClick={() => { stopScan(); setScanMode(false); }}>Cancel</Button>
          </div>
        )}
      </main>
    </AppFrame>
  );
}

// ── Print stylesheet ───────────────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body > * { display: none !important; }
  #emg-card {
    display: block !important;
    color: #000 !important;
    background: #fff !important;
    border: 2px solid #dc2626 !important;
    border-radius: 12px;
    padding: 16px;
    max-width: 340px;
    margin: 0 auto;
  }
  button, video { display: none !important; }
}
`;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="shrink-0 text-[11px] font-medium text-muted">{label}</p>
      <p className="text-right text-sm text-ink">{value}</p>
    </div>
  );
}

function VitalBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[12px] bg-surface py-2">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[10px] text-faint">{unit}</p>
    </div>
  );
}
