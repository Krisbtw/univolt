/**
 * /staff — Shared clinic tablet triage view & tele-consult queue.
 * No login/roles. All patients from the local univolt store, sorted urgent-first.
 * QR scan support via BarcodeDetector + manual ID fallback.
 * Store-and-forward tele-consultation queue with plain-text shareable packets.
 * Low-bandwidth JSON backup export / import.
 */
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { latestScan, selectActiveConsults, useUnivolt } from "@/lib/univolt/store";
import { evaluateTriage } from "@/lib/triage";
import { getPriorityFromFusion, getPriorityFromVitals, priorityMeta } from "@/lib/priority";
import { buildConsultSharePacket } from "@/lib/consultPacket";
import { getStrings, type Locale, type Strings } from "@/lib/translations";
import { loadLocale } from "@/lib/vitalsDatabase";
import type { Patient, TeleConsultRequest, UnivoltDb, VitalsScan } from "@/lib/univolt/types";

export const Route = createFileRoute("/staff")({ component: StaffScreen });

// ── Triage sort key ───────────────────────────────────────────────────────────
const TRIAGE_PRIORITY: Record<string, number> = {
  hypoxia: 0,
  bradycardia: 0,
  tachycardia: 0,
  tachypnea: 1,
  borderline: 2,
  normal: 3,
  inconclusive: 4,
  none: 5,
};

function triagePriority(scan: VitalsScan | null): number {
  if (!scan) return TRIAGE_PRIORITY.none;
  const t = evaluateTriage({
    bpm: scan.heartRate,
    hrv: scan.hrvRmssd,
    spo2: scan.spo2Estimate,
    rr: scan.respiratoryRate,
  });
  return TRIAGE_PRIORITY[t.level] ?? 5;
}

function triageLabel(scan: VitalsScan | null): { label: string; color: string } {
  if (!scan) return { label: "—", color: "text-muted" };
  const t = evaluateTriage({
    bpm: scan.heartRate,
    hrv: scan.hrvRmssd,
    spo2: scan.spo2Estimate,
    rr: scan.respiratoryRate,
  });
  switch (t.level) {
    case "hypoxia":
    case "bradycardia":
    case "tachycardia":
    case "tachypnea":
      return { label: "URGENT", color: "text-red-400" };
    case "borderline":
      return { label: "PHC today", color: "text-amber-500" };
    case "normal":
      return { label: "Stable", color: "text-pine" };
    default:
      return { label: "No data", color: "text-muted" };
  }
}

type StaffTab = "triage" | "consults";
type FilterMode = "all" | "urgent" | "phc";

// ── BarcodeDetector types ─────────────────────────────────────────────────────
declare class BarcodeDetector {
  constructor(opts?: { formats?: string[] });
  detect(source: HTMLVideoElement | HTMLImageElement | ImageBitmap): Promise<
    Array<{ rawValue: string; format: string }>
  >;
}

function StaffScreen() {
  const db = useUnivolt((s) => s.db);
  const importDb = useUnivolt((s) => s.importDb);
  const updateConsultStatus = useUnivolt((s) => s.updateConsultStatus);
  const navigate = useNavigate();
  const locale = (loadLocale() ?? "en") as Locale;
  const t: Strings = getStrings(locale);

  const [activeTab, setActiveTab] = useState<StaffTab>("triage");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [manualId, setManualId] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active consults sorted urgent-first
  const consults = useMemo(() => selectActiveConsults(db), [db]);
  const pendingConsultsCount = useMemo(
    () => (db.consults ?? []).filter((c) => c.status !== "completed").length,
    [db.consults],
  );

  // Sort patients by triage priority
  const sortedPatients = useMemo(() => {
    const list = [...db.patients].map((p) => ({
      patient: p,
      scan: latestScan(db, p.id),
    }));
    list.sort((a, b) => triagePriority(a.scan) - triagePriority(b.scan));
    return list;
  }, [db]);

  const filtered = useMemo(() => {
    return sortedPatients.filter(({ scan }) => {
      if (filter === "all") return true;
      const { label } = triageLabel(scan);
      if (filter === "urgent") return label === "URGENT";
      if (filter === "phc") return label === "PHC today";
      return true;
    });
  }, [sortedPatients, filter]);

  function handleManualSearch() {
    const q = manualId.trim().toLowerCase();
    if (!q) return;
    const found = db.patients.find(
      (p) => p.caseId.toLowerCase() === q || p.id.toLowerCase() === q,
    );
    if (found) {
      void navigate({ to: "/patient/$id", params: { id: found.id } });
    } else {
      setNotFound(true);
    }
  }

  function handleExportBackup() {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unicare-clinic-backup-${format(Date.now(), "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage(t.backupExportBtn + " ✓");
    setTimeout(() => setBackupMessage(null), 3000);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as UnivoltDb;
        const res = importDb(parsed);
        if (res.success) {
          setBackupMessage(`${t.backupImportSuccess} (${res.count} patients)`);
        } else {
          setBackupMessage(t.backupImportError);
        }
      } catch {
        setBackupMessage(t.backupImportError);
      }
      setTimeout(() => setBackupMessage(null), 4000);
    };
    reader.readAsText(file);
  }

  return (
    <AppFrame>
      <AppHeader back={{ to: "/" }} title={t.staffTitle} subtitle={t.staffSubtitle} />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-4">
        {/* Demo disclaimer */}
        <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            🏥 {t.staffDemoNote}
          </span>
        </div>

        {/* Primary View Switcher: Triage List vs Consult Queue */}
        <div className="flex gap-2 rounded-[14px] border border-line bg-surface p-1">
          <button
            type="button"
            id="tab-staff-triage"
            onClick={() => setActiveTab("triage")}
            className={`flex-1 rounded-[10px] py-2 text-xs font-semibold transition-colors ${
              activeTab === "triage"
                ? "bg-pine text-paper shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            📋 {t.triageListTab} ({db.patients.length})
          </button>
          <button
            type="button"
            id="tab-staff-consults"
            onClick={() => setActiveTab("consults")}
            className={`flex-1 rounded-[10px] py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "consults"
                ? "bg-pine text-paper shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            🩺 {t.consultQueueTab}
            {pendingConsultsCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {pendingConsultsCount}
              </span>
            )}
          </button>
        </div>

        {/* ── TAB 1: TRIAGE ROSTER ── */}
        {activeTab === "triage" && (
          <div className="flex flex-col gap-4">
            {/* QR Scanner */}
            <QrScanPanel
              t={t}
              open={scannerOpen}
              setOpen={setScannerOpen}
              onFound={(id) => void navigate({ to: "/patient/$id", params: { id } })}
              patients={db.patients}
            />

            {/* Manual ID lookup */}
            <div className="flex gap-2">
              <Input
                id="staff-manual-id"
                value={manualId}
                onChange={(e) => {
                  setManualId(e.target.value);
                  setNotFound(false);
                }}
                placeholder={t.staffManualIdPlaceholder}
                aria-label={t.staffManualIdLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSearch();
                }}
              />
              <Button size="sm" onClick={handleManualSearch} id="btn-staff-find">
                {t.staffManualIdSubmit}
              </Button>
            </div>
            {notFound && <p className="text-sm text-red-400">{t.staffNotFound}</p>}

            {/* Filter tabs */}
            <div className="flex gap-1 rounded-[12px] bg-surface p-0.5">
              {(["all", "urgent", "phc"] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilter(mode)}
                  className={`flex-1 rounded-[10px] py-1.5 text-[12px] font-semibold transition-colors ${
                    filter === mode ? "bg-pine text-paper" : "text-muted"
                  }`}
                >
                  {mode === "all"
                    ? t.staffFilterAll
                    : mode === "urgent"
                    ? t.staffFilterUrgent
                    : t.staffFilterPhc}
                </button>
              ))}
            </div>

            {/* Patient list */}
            {db.patients.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-muted">
                {t.staffNoPatients}
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {filtered.map(({ patient, scan }) => (
                  <StaffPatientRow
                    key={patient.id}
                    patient={patient}
                    scan={scan}
                    t={t}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── TAB 2: TELE-CONSULT QUEUE ── */}
        {activeTab === "consults" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[14px] border border-pine/30 bg-pine/8 px-4 py-3">
              <p className="text-xs text-pine font-medium leading-relaxed">
                {t.consultShareNote}
              </p>
            </div>

            {consults.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-line bg-paper px-4 py-12 text-center text-sm text-muted">
                {t.consultNoRequests}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {consults.map((req) => {
                  const patient = db.patients.find((p) => p.id === req.patientId) ?? null;
                  return (
                    <ConsultQueueCard
                      key={req.id}
                      req={req}
                      patient={patient}
                      t={t}
                      onUpdateStatus={updateConsultStatus}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── BACKUP & RESTORE SECTION ── */}
        <section className="mt-4 rounded-[20px] border border-line bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Offline Data Backup
              </p>
              <p className="text-[11px] text-faint">
                Export or restore clinic data without network.
              </p>
            </div>
            {backupMessage && (
              <span className="text-xs font-medium text-pine animate-pulse">
                {backupMessage}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              id="btn-export-backup"
              variant="outline"
              size="sm"
              onClick={handleExportBackup}
              className="flex-1 text-xs"
            >
              📥 {t.backupExportBtn}
            </Button>
            <Button
              id="btn-import-backup-trigger"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 text-xs"
            >
              📤 {t.backupImportBtn}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </section>

        {/* Disclaimer */}
        <p className="mt-2 text-center text-[11px] leading-relaxed text-faint">
          {t.staffSubtitle}
        </p>
      </main>
    </AppFrame>
  );
}

// ── Patient Row with Priority Flag ──────────────────────────────────────────
function StaffPatientRow({
  patient,
  scan,
  t,
}: {
  patient: Patient;
  scan: VitalsScan | null;
  t: Strings;
}) {
  const { label } = triageLabel(scan);
  const flag = scan
    ? getPriorityFromVitals({
        bpm: scan.heartRate,
        rr: scan.respiratoryRate,
        spo2: scan.spo2Estimate,
        hrv: scan.hrvRmssd,
      })
    : "green";
  const pMeta = priorityMeta(flag);

  return (
    <li>
      <Link
        to="/patient/$id"
        params={{ id: patient.id }}
        className="flex items-start justify-between gap-3 rounded-[20px] border border-line bg-paper p-4 no-underline hover:border-pine/30 transition-colors"
      >
        <div>
          <div className="flex items-center gap-2">
            {/* Priority Flag Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${pMeta.badgeBg} ${pMeta.badgeBorder} ${pMeta.textColor}`}
            >
              <span className={`size-1.5 rounded-full ${pMeta.dotColor}`} />
              {label}
            </span>
            <Badge variant="muted">{patient.caseId}</Badge>
          </div>
          <p className="mt-1.5 text-base font-semibold text-ink">{patient.name}</p>
          <p className="text-sm text-muted">
            {patient.village} · {patient.age}
            {patient.sex}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
          <p className="text-[11px] text-muted">
            {t.staffLastVisit}: {formatDistanceToNow(patient.lastVisitAt, { addSuffix: true })}
          </p>
          {scan ? (
            <p className="text-[11px] tabular-nums text-muted">
              ❤️ {scan.heartRate} · 🫁 {scan.respiratoryRate}
              {scan.spo2Estimate != null ? ` · SpO₂ ${scan.spo2Estimate}%` : ""}
            </p>
          ) : (
            <p className="text-[11px] text-faint">{t.staffNoVitals}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

// ── Consult Queue Card Component ─────────────────────────────────────────────
function ConsultQueueCard({
  req,
  patient,
  t,
  onUpdateStatus,
}: {
  req: TeleConsultRequest;
  patient: Patient | null;
  t: Strings;
  onUpdateStatus: (id: string, status: TeleConsultRequest["status"], note?: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [noteText, setNoteText] = useState(req.notes ?? "");
  const [editingNote, setEditingNote] = useState(false);

  const flag = getPriorityFromFusion(req.triageLevel);
  const pMeta = priorityMeta(flag);

  const sharePacketText = useMemo(
    () => buildConsultSharePacket(req, patient, t),
    [req, patient, t],
  );

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `UniCare Tele-Consult — ${patient?.caseId ?? req.patientId}`,
          text: sharePacketText,
        });
        return;
      }
    } catch {
      // fallback to clipboard
    }
    await navigator.clipboard.writeText(sharePacketText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleSaveNote() {
    onUpdateStatus(req.id, req.status, noteText.trim());
    setEditingNote(false);
  }

  return (
    <li className="flex flex-col gap-3 rounded-[20px] border border-line bg-paper p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pMeta.badgeBg} ${pMeta.badgeBorder} ${pMeta.textColor}`}
            >
              <span className={`size-1.5 rounded-full ${pMeta.dotColor}`} />
              {pMeta.labelEn}
            </span>
            <Badge variant="muted">{patient?.caseId ?? req.patientId}</Badge>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[8px] ${
                req.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : req.status === "sent"
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              }`}
            >
              {req.status === "completed"
                ? t.consultStatusCompleted
                : req.status === "sent"
                ? t.consultStatusSent
                : t.consultStatusRequested}
            </span>
          </div>

          <p className="mt-1.5 text-base font-semibold text-ink">
            {patient?.name ?? "Unknown Patient"}
          </p>
          <p className="text-xs text-muted">
            {patient ? `${patient.village} · ${patient.age}${patient.sex}` : ""} ·{" "}
            {format(req.createdAt, "d MMM yyyy, HH:mm")}
          </p>
        </div>

        <Link
          to="/patient/$id"
          params={{ id: req.patientId }}
          className="text-xs font-semibold text-pine hover:underline shrink-0"
        >
          View profile →
        </Link>
      </div>

      {/* Vitals Summary Grid */}
      <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-surface p-2.5 text-xs">
        {req.vitals.hr != null && req.vitals.hr > 0 && (
          <p className="text-muted">
            ❤️ HR: <strong className="text-ink">{req.vitals.hr} bpm</strong>{" "}
            <span className="text-[10px] text-faint">(Camera)</span>
          </p>
        )}
        {req.vitals.rr != null && req.vitals.rr > 0 && (
          <p className="text-muted">
            🫁 RR: <strong className="text-ink">{req.vitals.rr} /min</strong>{" "}
            <span className="text-[10px] text-faint">(Camera)</span>
          </p>
        )}
        {req.vitals.spo2 != null && (
          <p className="text-muted">
            🩸 SpO₂: <strong className="text-ink">{req.vitals.spo2}%</strong>{" "}
            <span className="text-[10px] text-faint">
              ({req.vitals.cameraSpo2Quality === "manual" ? "Equipment" : "Camera"})
            </span>
          </p>
        )}
        {req.vitals.bpSystolic != null && req.vitals.bpDiastolic != null && (
          <p className="text-muted">
            🩺 BP:{" "}
            <strong className="text-ink">
              {req.vitals.bpSystolic}/{req.vitals.bpDiastolic}
            </strong>{" "}
            <span className="text-[10px] text-faint">(Equipment)</span>
          </p>
        )}
        {req.vitals.temperatureC != null && (
          <p className="text-muted">
            🌡️ Temp: <strong className="text-ink">{req.vitals.temperatureC} °C</strong>{" "}
            <span className="text-[10px] text-faint">(Equipment)</span>
          </p>
        )}
      </div>

      {/* Reasons tags */}
      {req.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {req.reasons.map((r, idx) => (
            <span
              key={idx}
              className="rounded-[8px] bg-red-400/10 border border-red-400/20 px-2 py-0.5 text-[10px] font-medium text-red-300"
            >
              • {r.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Clinician Note */}
      <div className="flex flex-col gap-1 border-t border-line/60 pt-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-muted text-[11px]">{t.consultNotesLabel}:</span>
          {!editingNote && (
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              className="text-[11px] text-pine hover:underline"
            >
              {req.notes ? "Edit note" : "+ Add note"}
            </button>
          )}
        </div>
        {editingNote ? (
          <div className="flex gap-2 mt-1">
            <Input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t.consultAddNote}
              className="text-xs h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveNote();
              }}
            />
            <Button size="sm" className="h-8 text-xs" onClick={handleSaveNote}>
              Save
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink italic">
            {req.notes || <span className="text-faint not-italic">No clinician note.</span>}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
        <Button
          id={`btn-share-consult-${req.id}`}
          size="sm"
          variant="outline"
          onClick={handleShare}
          className="text-xs gap-1 border-pine/40 text-pine"
        >
          📲 {copied ? t.consultCopied : t.consultShareBtn}
        </Button>

        <div className="flex items-center gap-1.5">
          {req.status === "requested" && (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs"
              onClick={() => onUpdateStatus(req.id, "sent")}
            >
              📤 {t.consultMarkSent}
            </Button>
          )}
          {req.status !== "completed" && (
            <Button
              size="sm"
              className="text-xs"
              onClick={() => onUpdateStatus(req.id, "completed")}
            >
              ✓ {t.consultMarkCompleted}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

// ── QR scan panel ─────────────────────────────────────────────────────────────
function QrScanPanel({
  t,
  open,
  setOpen,
  onFound,
  patients,
}: {
  t: Strings;
  open: boolean;
  setOpen: (v: boolean) => void;
  onFound: (id: string) => void;
  patients: Patient[];
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const startScanner = useCallback(async () => {
    if (!supported) return;
    setScanError(null);
    try {
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      scanFrame();
    } catch {
      setScanError(t.staffScanQrUnsupported);
    }
  }, [supported, t]);

  function scanFrame() {
    rafRef.current = requestAnimationFrame(async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        scanFrame();
        return;
      }
      try {
        const results = await detector.detect(video);
        if (results.length > 0) {
          const raw = results[0]!.rawValue;
          let patientId: string | null = null;
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            patientId = String(parsed.id ?? parsed.caseId ?? "");
          } catch {
            patientId = raw.trim();
          }
          const found = patients.find(
            (p) => p.id === patientId || p.caseId === patientId,
          );
          if (found) {
            stop();
            setOpen(false);
            onFound(found.id);
            return;
          }
        }
      } catch {
        // continue scanning
      }
      scanFrame();
    });
  }

  if (!open) {
    return (
      <Button
        id="btn-staff-scan-qr"
        variant="outline"
        size="sm"
        className="gap-2 border-pine/40 text-pine"
        onClick={() => {
          setOpen(true);
          void startScanner();
        }}
      >
        📷 {t.staffScanQr}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] border border-line bg-black/90">
        <video ref={videoRef} playsInline muted className="size-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-40 rounded-[18px] border-2 border-pine/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
        </div>
        <p className="absolute bottom-3 inset-x-0 text-center text-[11px] text-paper/80">
          {t.staffScanQrInstructions}
        </p>
      </div>
      {!supported && <p className="text-sm text-muted">{t.staffScanQrUnsupported}</p>}
      {scanError && <p className="text-sm text-muted">{scanError}</p>}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          stop();
          setOpen(false);
        }}
      >
        {t.intakeBack}
      </Button>
    </div>
  );
}
