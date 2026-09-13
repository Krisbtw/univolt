import { Link, createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, Mic, AlertTriangle } from "lucide-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { SavedLocalBadge } from "@/components/sync-indicator";
import { HrChart, RrChart, Spo2Chart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  latestCough,
  selectCoughs,
  selectPatient,
  selectScans,
  selectPatientConsults,
  useUnivolt,
  communicationProfile,
} from "@/lib/univolt/store";
import { generateVisitSummary } from "@/lib/visitSummary";
import type { VisitSummary, SummaryLine } from "@/lib/visitSummary";
import { getStrings, type Locale, type Strings } from "@/lib/translations";
import { loadLocale } from "@/lib/vitalsDatabase";
import { useFusionSession } from "@/lib/fusionStore";
import { evaluateFusion, type FusionReason, type FusionInputs } from "@/lib/fusionEngine";
import { getPriorityFromFusion, getPriorityFromVitals, priorityMeta } from "@/lib/priority";
import { buildConsultSharePacket } from "@/lib/consultPacket";
import type { Patient, TeleConsultRequest, VitalsScan } from "@/lib/univolt/types";

export const Route = createFileRoute("/patient/$id/")({ component: PatientProfileScreen });

const FUSION_REASON_LABELS: Record<string, string> = {
  bpm_extreme: "Heart rate > 150 bpm",
  shock_pattern: "Fast HR + prolonged CRT (shock pattern)",
  chest_pain: "Chest pain reported",
  fainting: "Fainting / loss of consciousness",
  bleeding: "Active bleeding reported",
  fet_obstruction: "Breathing time > 6 s (airway obstruction)",
  tachycardia: "Heart rate > 100 bpm",
  bradycardia: "Heart rate < 50 bpm",
  tachypnea: "Breathing rate > 24 /min",
  crt_elevated: "Capillary refill time 3–5 s",
  pregnant_abnormal: "Pregnancy + abnormal signal",
  fever_3d: "Fever ≥ 3 days",
  breathless: "Breathlessness reported",
  all_normal: "All measured signals in normal range",
};

type WindowDays = 7 | 30;

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

const SUMMARY_STRINGS: Record<string, string> = {
  vs_hr_up: "Heart rate increased {delta} bpm; {range}.",
  vs_hr_down: "Heart rate decreased {delta} bpm; {range}.",
  vs_rr_up: "Respiratory rate increased {delta} /min; {range}.",
  vs_rr_down: "Respiratory rate decreased {delta} /min; {range}.",
  vs_spo2_up: "SpO₂ improved by {delta}%; {range}.",
  vs_spo2_down: "SpO₂ decreased {delta}%; {range}.",
  vs_all_stable: "Vitals remain within expected range.",
  vs_followup_self_care: "Routine monitoring.",
  vs_followup_phc: "Follow-up at the nearest PHC today.",
  vs_followup_urgent: "Urgent referral advised.",
  vs_followup_default: "Repeat the scan after rest.",
  in_range: "still within normal range",
  out_of_range: "outside normal range — monitor closely",
};

function renderSummaryLine(line: SummaryLine): string {
  const tpl = SUMMARY_STRINGS[line.key] ?? line.key;
  const params = line.params
    ? {
        ...line.params,
        range: SUMMARY_STRINGS[String(line.params["range"])] ?? String(line.params["range"] ?? ""),
      }
    : undefined;
  return interpolate(tpl, params);
}

function buildPlainText(summary: VisitSummary, caseId: string): string {
  const lines: string[] = [
    "CLINICAL VISIT SUMMARY",
    `Case: ${caseId}`,
    `Generated: ${format(summary.generatedAt, "d MMM yyyy, HH:mm")}`,
    "",
    `Previous visit: ${
      summary.previous
        ? `HR ${summary.previous.hr ?? "--"} bpm | RR ${summary.previous.rr ?? "--"} /min${
            summary.previous.spo2 != null ? ` | SpO₂ ${summary.previous.spo2}%` : ""
          }`
        : "First visit"
    }`,
    `Current visit:  ${
      summary.current
        ? `HR ${summary.current.hr ?? "--"} bpm | RR ${summary.current.rr ?? "--"} /min${
            summary.current.spo2 != null ? ` | SpO₂ ${summary.current.spo2}%` : ""
          }`
        : "--"
    }`,
    "",
    "Changes:",
    ...summary.changeLines.map((l) => `  • ${renderSummaryLine(l)}`),
    "",
    `Follow-up: ${renderSummaryLine(summary.followUpLine)}`,
    "",
    "Not a medical device. Screening only. Confirm with clinical staff.",
  ];
  return lines.join("\n");
}

function DeltaBanner({ summary }: { summary: VisitSummary }) {
  if (!summary.previous || !summary.current) return null;
  const isStable = summary.changeLines.length === 1 && summary.changeLines[0]?.key === "vs_all_stable";
  return (
    <div
      className={`rounded-[16px] border px-4 py-3 ${
        isStable ? "border-line bg-surface" : "border-amber-400/30 bg-amber-400/8"
      }`}
    >
      {summary.changeLines.map((line, i) => {
        const text = renderSummaryLine(line);
        const isNotable = line.key !== "vs_all_stable";
        return (
          <p
            key={i}
            className={`text-sm leading-relaxed ${isNotable ? "text-amber-300" : "text-muted"}`}
          >
            {isNotable ? "⚠️ " : "✓ "}
            {text}
          </p>
        );
      })}
    </div>
  );
}

function VisitSummaryCard({ summary, caseId }: { summary: VisitSummary; caseId: string }) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const plainText = buildPlainText(summary, caseId);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = plainText;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [plainText]);

  const handlePrint = useCallback(() => window.print(), []);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Clinical Visit Summary", text: plainText });
        return;
      } catch {
        // fallback
      }
    }
    handleCopy();
  }, [plainText, handleCopy]);

  const fmtVitals = (v: { hr: number | null; rr: number | null; spo2: number | null } | null) => {
    if (!v) return "—";
    const parts = [
      v.hr != null ? `HR ${v.hr} bpm` : null,
      v.rr != null ? `RR ${v.rr} /min` : null,
      v.spo2 != null ? `SpO₂ ${v.spo2}%` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "—";
  };

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div id="visit-summary-card" ref={cardRef} className="rounded-[20px] border border-line bg-paper p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Clinical Visit Summary</h2>
        <p className="mt-0.5 text-[11px] text-faint">
          Case {caseId} · {format(summary.generatedAt, "d MMM yyyy, HH:mm")}
        </p>
        <div className="mt-3 grid gap-2">
          <SummaryRow label="Previous visit" value={summary.previous ? fmtVitals(summary.previous) : "First visit"} />
          <SummaryRow label="Current visit" value={summary.current ? fmtVitals(summary.current) : "—"} />
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted uppercase tracking-wide">Change</p>
          {summary.changeLines.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink">
              {renderSummaryLine(line)}
            </p>
          ))}
        </div>
        <div className="mt-3 rounded-[12px] bg-surface px-3 py-2">
          <p className="text-[11px] text-muted">Follow-up</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{renderSummaryLine(summary.followUpLine)}</p>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-faint">
          Not a medical device. Clinical visit notes for screening only. Confirm findings with trained clinical staff.
        </p>
        <div className="mt-3 flex gap-2">
          <Button id="btn-vs-copy" size="sm" variant="secondary" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button id="btn-vs-print" size="sm" variant="secondary" onClick={handlePrint}>
            Print
          </Button>
          <Button id="btn-vs-share" size="sm" variant="secondary" onClick={handleShare}>
            Share
          </Button>
        </div>
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="shrink-0 text-[11px] text-muted">{label}</p>
      <p className="text-right text-[12px] font-medium text-ink">{value}</p>
    </div>
  );
}

const PRINT_CSS = `
@media print {
  body > * { display: none !important; }
  #visit-summary-card { display: block !important; color: #000 !important; background: #fff !important; padding: 24px; }
  button { display: none !important; }
}
`;

// ── Manual Vitals Form (Clinic Equipment) ────────────────────────────────────
function ManualVitalsForm({ patientId, t }: { patientId: string; t: Strings }) {
  const addManualVitals = useUnivolt((s) => s.addManualVitals);
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [temp, setTemp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    const sys = bpSys ? Number(bpSys) : null;
    const dia = bpDia ? Number(bpDia) : null;
    const tc = temp ? Number(temp) : null;
    const sp = spo2 ? Number(spo2) : null;

    if (sys == null && dia == null && tc == null && sp == null) return;

    addManualVitals(patientId, {
      bpSystolic: sys,
      bpDiastolic: dia,
      temperatureC: tc,
      spo2: sp,
    });
    setBpSys("");
    setBpDia("");
    setTemp("");
    setSpo2("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [patientId, bpSys, bpDia, temp, spo2, addManualVitals]);

  return (
    <section className="rounded-[24px] border-2 border-dashed border-indigo-400/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🩺</span>
          <h2 className="text-sm font-semibold text-ink">{t.manualVitalsTitle}</h2>
        </div>
        <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
          CLINIC EQUIPMENT
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted">{t.manualVitalsDesc}</p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-medium text-muted mb-1">{t.bpSystolicLabel}</label>
          <input
            id="input-bp-sys"
            type="number"
            min={50}
            max={260}
            placeholder="e.g. 120"
            value={bpSys}
            onChange={(e) => setBpSys(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted mb-1">{t.bpDiastolicLabel}</label>
          <input
            id="input-bp-dia"
            type="number"
            min={30}
            max={160}
            placeholder="e.g. 80"
            value={bpDia}
            onChange={(e) => setBpDia(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted mb-1">{t.tempLabel}</label>
          <input
            id="input-temp"
            type="number"
            step="0.1"
            min={34}
            max={43}
            placeholder="e.g. 37.0"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted mb-1">SpO₂ (%)</label>
          <input
            id="input-manual-spo2-field"
            type="number"
            min={50}
            max={100}
            placeholder="e.g. 98"
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {saved ? (
          <span className="text-xs font-medium text-indigo-400">{t.manualVitalsSaved}</span>
        ) : (
          <span />
        )}
        <Button id="btn-save-manual-vitals" size="sm" onClick={handleSave}>
          {t.manualSaveBtn}
        </Button>
      </div>
    </section>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
function PatientProfileScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const requestTeleConsult = useUnivolt((s) => s.requestTeleConsult);
  const patient = selectPatient(db, id);
  const scans = selectScans(db, id);
  const coughs = selectCoughs(db, id);
  const lastCough = latestCough(db, id);
  const patientConsults = selectPatientConsults(db, id);

  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [copiedConsult, setCopiedConsult] = useState(false);
  const [consultRequestedNotice, setConsultRequestedNotice] = useState(false);

  const t = useMemo(() => getStrings(loadLocale() ?? "en"), []);

  const cameraScans = scans.filter((s) => !s.source || s.source === "scan");
  const manualScans = scans.filter((s) => s.source === "manual");
  const acceptedSpo2Scans = scans.filter(
    (s) =>
      s.spo2Estimate != null &&
      (s.source === "manual" || s.spo2Quality === "good" || s.spo2Quality === "weak"),
  );
  const lastScan = cameraScans[cameraScans.length - 1] ?? null;
  const lastManualScan = manualScans[manualScans.length - 1] ?? null;
  const cameraSpo2 =
    lastScan?.spo2Quality === "good" || lastScan?.spo2Quality === "weak"
      ? lastScan.spo2Estimate
      : null;
  const latestSpo2 = cameraSpo2 ?? lastManualScan?.spo2Estimate ?? null;

  const fusionSession = useFusionSession();
  const fusionInputs = useMemo(
    (): FusionInputs => ({
      ...fusionSession,
      ageYears: patient ? patient.age : undefined,
      rppg:
        fusionSession.rppg ??
        (lastScan
          ? {
              bpm: lastScan.heartRate,
              rr: lastScan.respiratoryRate,
              hrv: lastScan.hrvRmssd,
              quality: (lastScan.signalQuality > 50 ? "good" : "weak") as "good" | "weak",
            }
          : undefined),
      spo2:
        fusionSession.spo2 ??
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
    }),
    [fusionSession, patient, lastScan, latestSpo2],
  );
  const fusionResult = useMemo(() => evaluateFusion(fusionInputs), [fusionInputs]);
  const hasFusionData =
    fusionResult.signalsUsed > 0 ||
    Boolean(fusionInputs.symptoms && Object.values(fusionInputs.symptoms).some(Boolean)) ||
    fusionResult.reasons.length > 0;

  const hasTwoScans = cameraScans.length >= 2;

  // Contextual tie-in: check if fever or breathlessness is noted
  const hasFeverOrBreathless = useMemo(() => {
    if (fusionResult.reasons.some((r) => r.code === "fever_3d" || r.code === "breathless")) return true;
    if (fusionInputs.symptoms?.breathless || (Number(fusionInputs.symptoms?.feverDays) || 0) > 0) return true;
    if (lastManualScan?.temperatureC != null && lastManualScan.temperatureC >= 37.8) return true;
    if (lastScan?.respiratoryRate != null && lastScan.respiratoryRate >= 24) return true;
    if (latestSpo2 != null && latestSpo2 < 93) return true;
    return false;
  }, [fusionResult.reasons, fusionInputs.symptoms, lastManualScan?.temperatureC, lastScan?.respiratoryRate, latestSpo2]);

  const latestConsult = patientConsults[0] ?? null;

  const handleGenerateSummary = useCallback(() => {
    const s = generateVisitSummary(id, scans);
    setSummary(s);
  }, [id, scans]);

  const handleRequestTeleConsult = useCallback(() => {
    if (!patient) return;
    requestTeleConsult(patient.id, {
      triageLevel: fusionResult.level,
      vitals: {
        hr: lastScan?.heartRate,
        rr: lastScan?.respiratoryRate,
        spo2: latestSpo2,
        bpSystolic: lastManualScan?.bpSystolic,
        bpDiastolic: lastManualScan?.bpDiastolic,
        temperatureC: lastManualScan?.temperatureC,
        cameraSpo2Quality: lastScan ? "scan" : "manual",
      },
      symptoms: fusionInputs.symptoms as Record<string, boolean | number> | undefined,
      reasons: fusionResult.reasons.map((r) => r.code),
    });
    setConsultRequestedNotice(true);
    setTimeout(() => setConsultRequestedNotice(false), 3000);
  }, [patient, fusionResult, lastScan, latestSpo2, lastManualScan, fusionInputs.symptoms, requestTeleConsult]);

  const handleShareConsult = useCallback(async (req: TeleConsultRequest) => {
    if (!patient) return;
    const packet = buildConsultSharePacket(req, patient, t);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Tele-Consult — ${patient.caseId}`,
          text: packet,
        });
        return;
      }
    } catch {
      // fallback to clipboard
    }
    await navigator.clipboard.writeText(packet);
    setCopiedConsult(true);
    setTimeout(() => setCopiedConsult(false), 2500);
  }, [patient, t]);

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
        <p className="px-4 pt-6 text-sm text-muted">This record is not on this device.</p>
      </AppFrame>
    );
  }

  // Priority flag mapping for patient header
  const patientPriority = getPriorityFromFusion(fusionResult.level);
  const patientPriorityMeta = priorityMeta(patientPriority);

  return (
    <AppFrame>
      <AppHeader back={{ to: "/" }} />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">
        {/* Patient card */}
        <div className="rounded-[24px] border border-line bg-paper p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
                  {patient.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${patientPriorityMeta.badgeBg} ${patientPriorityMeta.badgeBorder} ${patientPriorityMeta.textColor}`}
                >
                  <span className={`size-1.5 rounded-full ${patientPriorityMeta.dotColor}`} />
                  {patientPriorityMeta.labelEn}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {patient.village} · {patient.age}
                {patient.sex}
              </p>
            </div>
            <Badge variant="muted">{patient.caseId}</Badge>
          </div>
          <p className="mt-3 text-[12px] text-muted">
            Last visit {formatDistanceToNow(patient.lastVisitAt, { addSuffix: true })}
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button asChild size="lg" className="h-auto flex-col items-start gap-1 px-4 py-3.5">
            <Link to="/patient/$id/scan" params={{ id: patient.id }}>
              <Activity className="size-4" />
              <span className="text-left text-sm font-semibold">Start vitals scan</span>
            </Link>
          </Button>
          {/* Intake questionnaire */}
          <Button
            asChild
            variant="secondary"
            size="lg"
            className="h-auto flex-col items-start gap-1 px-4 py-3.5"
          >
            <Link to="/patient/$id/intake" params={{ id: patient.id }}>
              <span className="text-base leading-none">📋</span>
              <span className="text-left text-sm font-semibold">Health intake</span>
            </Link>
          </Button>
        </div>

        {/* SpO2 Fingertip Scan Button */}
        <Button
          asChild
          id="btn-patient-add-spo2"
          variant="secondary"
          size="lg"
          className="h-auto flex-col items-start gap-1 px-4 py-3.5 w-full border-pine/30 bg-pine/5 hover:bg-pine/10"
        >
          <Link to="/patient/$id/spo2" params={{ id: patient.id }}>
            <span className="text-base leading-none">🩸</span>
            <span className="text-left text-sm font-semibold text-pine dark:text-pine-fg">
              {t.spo2AddButton}
            </span>
          </Link>
        </Button>

        {/* Cough screening — suppress if patient marked as non-speaking */}
        {communicationProfile(patient).canSpeak ? (
          <Button
            asChild
            variant="secondary"
            size="lg"
            className="h-auto flex-col items-start gap-1 px-4 py-3.5 w-full"
          >
            <Link to="/patient/$id/cough" params={{ id: patient.id }}>
              <Mic className="size-4" />
              <span className="text-left text-sm font-semibold">Cough screening</span>
            </Link>
          </Button>
        ) : (
          <div className="rounded-[14px] border border-amber-400/30 bg-amber-400/8 px-4 py-2.5">
            <p className="text-[12px] text-amber-600">{t.commNonSpeakingNote}</p>
          </div>
        )}

        {/* Emergency card link */}
        <Link
          to="/emergency/$id"
          params={{ id: patient.id }}
          className="flex items-center gap-2 rounded-[16px] border border-red-400/30 bg-red-400/6 px-4 py-2.5 text-sm font-medium text-red-400"
        >
          <AlertTriangle className="size-4" /> Emergency Card
        </Link>

        {/* Triage / Fusion Assessment Banner */}
        {hasFusionData && (
          <section
            id="triage-assessment-card"
            className={`rounded-[24px] border p-4 ${
              fusionResult.level === "urgent"
                ? "border-red-400/40 bg-red-400/8"
                : fusionResult.level === "phc_today"
                ? "border-amber-400/40 bg-amber-400/8"
                : "border-pine/40 bg-pine/8"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {fusionResult.level === "urgent"
                    ? "🚨"
                    : fusionResult.level === "phc_today"
                    ? "⚠️"
                    : "✅"}
                </span>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    fusionResult.level === "urgent"
                      ? "text-red-400"
                      : fusionResult.level === "phc_today"
                      ? "text-amber-500"
                      : "text-pine"
                  }`}
                >
                  {fusionResult.level === "urgent"
                    ? "URGENT REFERRAL"
                    : fusionResult.level === "phc_today"
                    ? "PHC TODAY"
                    : "ROUTINE MONITORING"}
                </span>
              </div>
              <Badge variant="muted">
                {fusionResult.signalsUsed} signal{fusionResult.signalsUsed !== 1 ? "s" : ""}
              </Badge>
            </div>

            {fusionResult.reasons.length > 0 && (
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {fusionResult.reasons.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-medium text-ink">
                    <span
                      className={`size-1.5 rounded-full shrink-0 ${
                        r.weight >= 10
                          ? "bg-red-400"
                          : r.weight >= 5
                          ? "bg-amber-400"
                          : "bg-pine"
                      }`}
                    />
                    {FUSION_REASON_LABELS[r.code] ?? r.code}
                  </li>
                ))}
              </ul>
            )}

            {/* Request Tele-Consult Button on urgent/phc_today */}
            {(fusionResult.level === "urgent" || fusionResult.level === "phc_today") && (
              <div className="mt-3">
                <Button
                  id="btn-request-teleconsult"
                  size="sm"
                  onClick={handleRequestTeleConsult}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-2 rounded-[12px] gap-1.5"
                >
                  📞 {t.consultRequestBtn}
                </Button>
                {consultRequestedNotice && (
                  <p className="mt-1 text-center text-xs font-medium text-pine animate-pulse">
                    {t.consultRequestedSuccess}
                  </p>
                )}
              </div>
            )}

            {/* Links Row: Schemes, Advisories, Referral */}
            <div className="mt-3 pt-2.5 border-t border-line/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              {(fusionResult.level === "urgent" || fusionResult.level === "phc_today") && (
                <Link
                  id="link-fusion-schemes"
                  to="/schemes"
                  className="inline-flex items-center gap-1 font-semibold text-pine hover:underline"
                >
                  {t.schemesLinkFromFusion}
                </Link>
              )}

              {hasFeverOrBreathless && (
                <Link
                  id="link-fever-advisories"
                  to="/awareness"
                  search={{ topic: "fever" }}
                  className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  🌡️ {t.advisoriesSeeFeverLink}
                </Link>
              )}

              <Link
                id="link-referral-slip"
                to="/referral"
                search={{ patientId: patient.id }}
                className="text-[11px] font-medium text-muted hover:text-ink"
              >
                Referral slip →
              </Link>
            </div>
          </section>
        )}

        {/* Tele-Consult Active Request Card */}
        {latestConsult && (
          <section className="rounded-[20px] border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📞</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-blue-500">
                  Tele-Consult Packet
                </h2>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[8px] ${
                  latestConsult.status === "completed"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : latestConsult.status === "sent"
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}
              >
                {latestConsult.status === "completed"
                  ? t.consultStatusCompleted
                  : latestConsult.status === "sent"
                  ? t.consultStatusSent
                  : t.consultStatusRequested}
              </span>
            </div>

            <p className="mt-1 text-[11px] text-muted">
              Requested {formatDistanceToNow(latestConsult.createdAt, { addSuffix: true })} ·{" "}
              {latestConsult.notes || "Ready for doctor handoff"}
            </p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                id="btn-share-consult-patient"
                size="sm"
                variant="outline"
                className="text-xs gap-1 border-blue-400 text-blue-500"
                onClick={() => handleShareConsult(latestConsult)}
              >
                📲 {copiedConsult ? t.consultCopied : t.consultShareBtn}
              </Button>
              <Link to="/staff" className="text-[11px] text-muted hover:underline">
                Open in staff queue →
              </Link>
            </div>
            <p className="mt-2 text-[10px] text-faint leading-relaxed">{t.consultShareNote}</p>
          </section>
        )}

        {/* Manual Vitals Entry Form (Clinic Equipment) */}
        <ManualVitalsForm patientId={patient.id} t={t} />

        {/* Latest Vitals (Camera vs Equipment) */}
        {lastScan ? (
          <section className="rounded-[24px] border border-line bg-paper p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Latest vitals</h2>
              <SavedLocalBadge />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Heart rate" value={`${lastScan.heartRate}`} unit="bpm" source="Camera" />
              <Metric label="Resp. rate" value={`${lastScan.respiratoryRate}`} unit="/min" source="Camera" />
              <Metric
                label="SpO₂"
                value={latestSpo2 != null ? `${latestSpo2}` : "--"}
                unit={latestSpo2 != null ? "%" : ""}
                source={cameraSpo2 != null ? "Camera" : "Equipment"}
              />
              <Metric
                label="Blood Pressure"
                value={
                  lastManualScan?.bpSystolic != null && lastManualScan?.bpDiastolic != null
                    ? `${lastManualScan.bpSystolic}/${lastManualScan.bpDiastolic}`
                    : "--"
                }
                unit={lastManualScan?.bpSystolic != null ? "mmHg" : ""}
                source="Equipment"
              />
            </div>
            {lastManualScan?.temperatureC != null && (
              <div className="mt-2 rounded-[14px] bg-surface px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted">Body Temperature</span>
                <strong className="text-ink">
                  {lastManualScan.temperatureC} °C{" "}
                  <span className="font-normal text-[10px] text-indigo-400">(Clinic Equipment)</span>
                </strong>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
              <span>Signal quality {lastScan.signalQuality}%</span>
              <span>{format(lastScan.capturedAt, "d MMM, HH:mm")}</span>
            </div>
          </section>
        ) : null}

        {/* Unified Patient Timeline */}
        <UnifiedPatientTimeline
          patient={patient}
          scans={scans}
          consults={patientConsults}
          coughs={coughs}
          t={t}
          onGenerateSummary={handleGenerateSummary}
        />

        {/* Trends section */}
        <section className="rounded-[24px] border border-line bg-paper p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Vitals Trend</h2>
            <div className="flex rounded-[10px] bg-surface p-0.5">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  id={`btn-trend-${d}d`}
                  onClick={() => setWindowDays(d)}
                  className={`rounded-[8px] px-3 py-1 text-[12px] font-medium transition-colors ${
                    windowDays === d ? "bg-pine text-paper" : "text-muted hover:text-ink"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {hasTwoScans && summary && <DeltaBanner summary={summary} />}

          {!hasTwoScans ? (
            <p className="py-6 text-sm text-muted">Run another scan to start a trend.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-4">
              <ChartRow label="Heart Rate" unit="bpm">
                <HrChart scans={scans} windowDays={windowDays} />
              </ChartRow>
              <ChartRow label="Respiratory Rate" unit="/min">
                <RrChart scans={scans} windowDays={windowDays} />
              </ChartRow>
              <ChartRow label="SpO₂ readings" unit="%">
                {acceptedSpo2Scans.length === 0 ? (
                  <p className="py-3 text-sm text-faint">
                    SpO₂ not measured — enter a reading if you have a pulse oximeter.
                  </p>
                ) : (
                  <Spo2Chart scans={scans} windowDays={windowDays} />
                )}
              </ChartRow>
            </div>
          )}
        </section>

        {/* Visit Summary */}
        <section className="rounded-[24px] border border-line bg-paper p-4">
          <h2 className="text-sm font-semibold text-ink">Clinical Visit Summary</h2>
          {cameraScans.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Run a vitals scan to generate a summary.</p>
          ) : (
            <>
              {!summary ? (
                <Button
                  id="btn-generate-summary"
                  size="sm"
                  className="mt-3"
                  onClick={handleGenerateSummary}
                >
                  Generate Visit Summary
                </Button>
              ) : (
                <div className="mt-3">
                  <VisitSummaryCard summary={summary} caseId={patient.caseId} />
                  <Button
                    id="btn-regenerate-summary"
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={handleGenerateSummary}
                  >
                    Regenerate
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </AppFrame>
  );
}

// ── Unified Patient Timeline Component ───────────────────────────────────────
function UnifiedPatientTimeline({
  patient,
  scans,
  consults,
  coughs,
  t,
  onGenerateSummary,
}: {
  patient: Patient;
  scans: VitalsScan[];
  consults: TeleConsultRequest[];
  coughs: any[];
  t: Strings;
  onGenerateSummary: () => void;
}) {
  // Aggregate events sorted by capturedAt / createdAt descending
  const events = useMemo(() => {
    type TimelineItem = {
      id: string;
      time: number;
      kind: "scan" | "manual_vitals" | "consult" | "cough";
      scan?: VitalsScan;
      consult?: TeleConsultRequest;
      cough?: any;
    };

    const list: TimelineItem[] = [];

    scans.forEach((s) => {
      list.push({
        id: s.id,
        time: s.capturedAt,
        kind: s.source === "manual" ? "manual_vitals" : "scan",
        scan: s,
      });
    });

    consults.forEach((c) => {
      list.push({
        id: c.id,
        time: c.createdAt,
        kind: "consult",
        consult: c,
      });
    });

    list.sort((a, b) => b.time - a.time);
    return list;
  }, [scans, consults]);

  return (
    <section className="rounded-[24px] border border-line bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t.timelineTitle}</h2>
          <p className="text-[11px] text-muted">{t.timelineSubtitle}</p>
        </div>
        <Badge variant="muted">{events.length} records</Badge>
      </div>

      {events.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">{t.timelineEmpty}</p>
      ) : (
        <ul className="relative flex flex-col gap-3 pl-4 border-l-2 border-line ml-2">
          {events.map((ev) => (
            <TimelineRow
              key={ev.id}
              event={ev}
              patient={patient}
              t={t}
              onGenerateSummary={onGenerateSummary}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TimelineRow({
  event,
  t,
  onGenerateSummary,
}: {
  event: {
    id: string;
    time: number;
    kind: string;
    scan?: VitalsScan;
    consult?: TeleConsultRequest;
  };
  patient: Patient;
  t: Strings;
  onGenerateSummary: () => void;
}) {
  const scan = event.scan;
  const consult = event.consult;

  // Determine priority flag
  let flag: "green" | "yellow" | "red" = "green";
  if (scan) {
    flag = getPriorityFromVitals({
      bpm: scan.heartRate || null,
      rr: scan.respiratoryRate || null,
      spo2: scan.spo2Estimate,
      hrv: scan.hrvRmssd || null,
    });
  } else if (consult) {
    flag = getPriorityFromFusion(consult.triageLevel);
  }
  const pMeta = priorityMeta(flag);

  return (
    <li className="relative flex flex-col gap-1.5 rounded-[16px] border border-line bg-surface p-3 text-xs">
      {/* Timeline Node Dot */}
      <span
        className={`absolute -left-[23px] top-3.5 size-3 rounded-full border-2 border-paper ${pMeta.dotColor}`}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted">
          {format(event.time, "d MMM yyyy, HH:mm")}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pMeta.badgeBg} ${pMeta.badgeBorder} ${pMeta.textColor}`}
        >
          <span className={`size-1.5 rounded-full ${pMeta.dotColor}`} />
          {pMeta.labelEn}
        </span>
      </div>

      {/* Content depending on kind */}
      {event.kind === "scan" && scan && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-ink font-semibold">
            <span>📷</span>
            <span>{t.sourceCamera}</span>
          </div>
          <p className="text-muted">
            HR: <strong className="text-ink">{scan.heartRate} bpm</strong> · RR:{" "}
            <strong className="text-ink">{scan.respiratoryRate} /min</strong>
            {scan.spo2Estimate != null ? (
              <span>
                {" "}
                · SpO₂: <strong className="text-ink">{scan.spo2Estimate}%</strong>
              </span>
            ) : null}
          </p>
        </div>
      )}

      {event.kind === "manual_vitals" && scan && (
        <div className="flex flex-col gap-1 border-l-2 border-indigo-400 pl-2">
          <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
            <span>🩺</span>
            <span>{t.sourceManual}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-muted">
            {scan.bpSystolic != null && scan.bpDiastolic != null && (
              <span>
                BP:{" "}
                <strong className="text-ink">
                  {scan.bpSystolic}/{scan.bpDiastolic} mmHg
                </strong>
              </span>
            )}
            {scan.temperatureC != null && (
              <span>
                Temp: <strong className="text-ink">{scan.temperatureC} °C</strong>
              </span>
            )}
            {scan.spo2Estimate != null && (
              <span>
                SpO₂: <strong className="text-ink">{scan.spo2Estimate}%</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {event.kind === "consult" && consult && (
        <div className="flex flex-col gap-1 border-l-2 border-blue-400 pl-2">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-blue-400">📞 Tele-Consult ({consult.status})</span>
            <span className="text-[10px] text-muted uppercase">{consult.triageLevel}</span>
          </div>
          {consult.reasons.length > 0 && (
            <p className="text-muted text-[11px]">
              Reasons: {consult.reasons.join(", ").replace(/_/g, " ")}
            </p>
          )}
          {consult.notes && (
            <p className="text-ink italic text-[11px]">"{consult.notes}"</p>
          )}
        </div>
      )}

      {/* Link to summary */}
      <div className="pt-1 mt-0.5 border-t border-line/40 flex justify-end">
        <button
          type="button"
          onClick={onGenerateSummary}
          className="text-[10px] text-pine hover:underline font-medium"
        >
          View visit notes →
        </button>
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  unit,
  source,
}: {
  label: string;
  value: string;
  unit: string;
  source?: string;
}) {
  return (
    <div className="rounded-[16px] bg-surface px-3 py-2.5 relative">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted">{label}</p>
        {source && (
          <span
            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
              source === "Equipment"
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                : "bg-surface text-faint"
            }`}
          >
            {source}
          </span>
        )}
      </div>
      <p className="mt-0.5 font-display text-[1.45rem] font-semibold tabular-nums tracking-[-0.03em] text-ink">
        {value}
        <span className="ml-1 font-sans text-[11px] font-medium text-faint">{unit}</span>
      </p>
    </div>
  );
}

function ChartRow({
  label,
  unit,
  children,
}: {
  label: string;
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[11px] font-medium text-muted">{label}</p>
        <span className="text-[10px] text-faint">{unit}</span>
      </div>
      {children}
    </div>
  );
}
