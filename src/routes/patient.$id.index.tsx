import { Link, createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, Mic, AlertTriangle } from "lucide-react";
import { useState, useCallback, useRef } from "react";
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
  useUnivolt,
} from "@/lib/univolt/store";
import { generateVisitSummary } from "@/lib/visitSummary";
import type { VisitSummary, SummaryLine } from "@/lib/visitSummary";

export const Route = createFileRoute("/patient/$id/")({ component: PatientProfileScreen });

// ── Helpers ───────────────────────────────────────────────────────────────────

type WindowDays = 7 | 30;

/** Interpolate {delta} and {range} params into a template string. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/** Map SummaryLine key → display string (en only for now). */
const SUMMARY_STRINGS: Record<string, string> = {
  vs_hr_up:       "Heart rate increased {delta} bpm; {range}.",
  vs_hr_down:     "Heart rate decreased {delta} bpm; {range}.",
  vs_rr_up:       "Respiratory rate increased {delta} /min; {range}.",
  vs_rr_down:     "Respiratory rate decreased {delta} /min; {range}.",
  vs_spo2_up:     "SpO₂ improved by {delta}%; {range}.",
  vs_spo2_down:   "SpO₂ decreased {delta}%; {range}.",
  vs_all_stable:  "Vitals remain within expected range.",
  vs_followup_self_care: "Routine monitoring.",
  vs_followup_phc:       "Follow-up at the nearest PHC today.",
  vs_followup_urgent:    "Urgent referral advised.",
  vs_followup_default:   "Repeat the scan after rest.",
  in_range:        "still within normal range",
  out_of_range:    "outside normal range — monitor closely",
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
    `Previous visit: ${summary.previous
      ? `HR ${summary.previous.hr ?? "--"} bpm | RR ${summary.previous.rr ?? "--"} /min${summary.previous.spo2 != null ? ` | SpO₂ ${summary.previous.spo2}%` : ""}`
      : "First visit"}`,
    `Current visit:  ${summary.current
      ? `HR ${summary.current.hr ?? "--"} bpm | RR ${summary.current.rr ?? "--"} /min${summary.current.spo2 != null ? ` | SpO₂ ${summary.current.spo2}%` : ""}`
      : "--"}`,
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

/** Delta banner: amber if any line is not "all stable". */
function DeltaBanner({ summary }: { summary: VisitSummary }) {
  if (!summary.previous || !summary.current) return null;
  const isStable = summary.changeLines.length === 1 && summary.changeLines[0]?.key === "vs_all_stable";
  return (
    <div className={`rounded-[16px] border px-4 py-3 ${
      isStable
        ? "border-line bg-surface"
        : "border-amber-400/30 bg-amber-400/8"
    }`}>
      {summary.changeLines.map((line, i) => {
        const text = renderSummaryLine(line);
        const isNotable = line.key !== "vs_all_stable";
        return (
          <p key={i} className={`text-sm leading-relaxed ${isNotable ? "text-amber-300" : "text-muted"}`}>
            {isNotable ? "⚠️ " : "✓ "}{text}
          </p>
        );
      })}
    </div>
  );
}

// ── Visit Summary Card ────────────────────────────────────────────────────────

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
      // fallback: select + execCommand
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
        // fallback to copy
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
          <SummaryRow label="Current visit"  value={summary.current  ? fmtVitals(summary.current)  : "—"} />
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

// ── Manual SpO₂ entry ─────────────────────────────────────────────────────────

function ManualSpo2Form({ patientId }: { patientId: string }) {
  const addManualSpo2 = useUnivolt((s) => s.addManualSpo2);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 50 || n > 100) return;
    addManualSpo2(patientId, n);
    setValue("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [value, patientId, addManualSpo2]);

  return (
    <div className="flex items-center gap-2 pt-1">
      <input
        id="input-manual-spo2"
        type="number"
        min={50}
        max={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 98"
        className="w-24 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-pine"
      />
      <span className="text-sm text-muted">%</span>
      <Button id="btn-save-spo2" size="sm" onClick={handleSave} disabled={!value}>
        {saved ? "Saved!" : "Save reading"}
      </Button>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

function PatientProfileScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const patient = selectPatient(db, id);
  const scans = selectScans(db, id);
  const coughs = selectCoughs(db, id);
  const lastCough = latestCough(db, id);

  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [summary, setSummary] = useState<VisitSummary | null>(null);

  const cameraScans = scans.filter((s) => !s.source || s.source === "scan");
  const manualSpo2Scans = scans.filter((s) => s.source === "manual");
  const lastScan = cameraScans[cameraScans.length - 1] ?? null;
  const lastManualSpo2 = manualSpo2Scans[manualSpo2Scans.length - 1] ?? null;

  const hasTwoScans = cameraScans.length >= 2;

  const handleGenerateSummary = useCallback(() => {
    const s = generateVisitSummary(id, scans);
    setSummary(s);
  }, [id, scans]);

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
        <p className="px-4 pt-6 text-sm text-muted">This record is not on this device.</p>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppHeader back={{ to: "/" }} />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">

        {/* Patient card */}
        <div className="rounded-[24px] border border-line bg-paper p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
                {patient.name}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {patient.village} · {patient.age}{patient.sex}
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
          <Button asChild variant="secondary" size="lg" className="h-auto flex-col items-start gap-1 px-4 py-3.5">
            <Link to="/patient/$id/cough" params={{ id: patient.id }}>
              <Mic className="size-4" />
              <span className="text-left text-sm font-semibold">Cough screening</span>
            </Link>
          </Button>
        </div>

        {/* Emergency card link */}
        <Link
          to="/emergency/$id"
          params={{ id: patient.id }}
          className="flex items-center gap-2 rounded-[16px] border border-red-400/30 bg-red-400/6 px-4 py-2.5 text-sm font-medium text-red-400"
        >
          <AlertTriangle className="size-4" /> Emergency Card
        </Link>

        {/* Latest vitals */}
        {lastScan ? (
          <section className="rounded-[24px] border border-line bg-paper p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Latest vitals</h2>
              <SavedLocalBadge />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Heart rate" value={`${lastScan.heartRate}`} unit="bpm" />
              <Metric label="HRV (RMSSD)" value={`${lastScan.hrvRmssd}`} unit="ms" />
              <Metric label="Resp. rate" value={`${lastScan.respiratoryRate}`} unit="/min" />
              <Metric
                label="SpO₂"
                value={lastManualSpo2 ? `${lastManualSpo2.spo2Estimate}` : "--"}
                unit={lastManualSpo2 ? "%" : ""}
              />
            </div>
            {!lastManualSpo2 && (
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                SpO₂ not measured — camera rPPG cannot replace a pulse oximeter.
              </p>
            )}
            <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
              <span>Signal quality {lastScan.signalQuality}%</span>
              <span>{format(lastScan.capturedAt, "d MMM, HH:mm")}</span>
            </div>
          </section>
        ) : null}

        {/* ── Trends section ── */}
        <section className="rounded-[24px] border border-line bg-paper p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Vitals Trend</h2>
            {/* 7-day / 30-day toggle */}
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

          {/* Delta banner — only when ≥ 2 scans */}
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
              <ChartRow label="SpO₂ — manual readings only" unit="%">
                {manualSpo2Scans.length === 0 ? (
                  <p className="py-3 text-sm text-faint">
                    SpO₂ not measured — enter a reading if you have a pulse oximeter.
                  </p>
                ) : (
                  <Spo2Chart scans={scans} windowDays={windowDays} />
                )}
              </ChartRow>
            </div>
          )}

          {/* Manual SpO₂ entry */}
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-[11px] font-medium text-muted">Enter pulse-oximeter SpO₂</p>
            <ManualSpo2Form patientId={patient.id} />
          </div>
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

        {/* Cough screening */}
        <section className="rounded-[24px] border border-line bg-paper p-4">
          <h2 className="text-sm font-semibold text-ink">Cough screening</h2>
          {lastCough ? (
            <div className="mt-3">
              <Badge variant={lastCough.classification === "Normal" ? "ok" : "warn"}>
                {lastCough.classification === "Normal" ? "Normal" : "Follow-up"}
              </Badge>
              <p className="mt-2 text-sm leading-relaxed text-ink">{lastCough.classification}</p>
              <p className="mt-1 text-[11px] text-faint">
                Prototype heuristic — not a diagnostic classifier. {format(lastCough.capturedAt, "d MMM, HH:mm")}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No cough screen on file.</p>
          )}
          {coughs.length > 1 ? (
            <ul className="mt-3 divide-y divide-line text-[12px] text-muted">
              {coughs.slice().reverse().slice(0, 4).map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-1.5">
                  <span>{c.classification === "Normal" ? "Normal" : "Follow-up"}</span>
                  <span>{format(c.capturedAt, "d MMM")}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </AppFrame>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-[16px] bg-surface px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 font-display text-[1.45rem] font-semibold tabular-nums tracking-[-0.03em] text-ink">
        {value}
        <span className="ml-1 font-sans text-[11px] font-medium text-faint">{unit}</span>
      </p>
    </div>
  );
}

function ChartRow({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
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
