import { Link, createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { CloudUpload, Loader2, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { latestCough, latestScan, useUnivolt } from "@/lib/univolt/store";
import { evaluateTriage } from "@/lib/triage";
import { getPriorityFromVitals, priorityMeta } from "@/lib/priority";
import type { Patient, VitalsScan } from "@/lib/univolt/types";

export const Route = createFileRoute("/")({ component: HomeScreen });

// Triage levels that require a follow-up warning badge.
const URGENT_TRIAGE_LEVELS = new Set(["hypoxia", "bradycardia", "tachycardia", "tachypnea"]);

function HomeScreen() {
  const db = useUnivolt((s) => s.db);
  const syncAllRecords = useUnivolt((s) => s.syncAllRecords);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done">("idle");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = [...db.patients].sort((a, b) => b.lastVisitAt - a.lastVisitAt);
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.caseId.toLowerCase().includes(q),
    );
  }, [db.patients, searchQuery]);

  const pendingCount = db.scans.filter((s) => s.syncStatus === "local").length
    + db.coughs.filter((c) => c.syncStatus === "local").length;

  function handleSync() {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    window.setTimeout(() => {
      syncAllRecords();
      setSyncState("done");
      window.setTimeout(() => setSyncState("idle"), 3000);
    }, 2000);
  }

  return (
    <AppFrame>
      <AppHeader subtitle={`${db.patients.length} patients in this catchment`} />
      <main className="flex flex-1 flex-col px-4 pb-8 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            id="roster-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or patient ID"
            aria-label="Search roster"
            className="pl-10 pr-11"
          />
          {searchQuery ? (
            <button
              type="button"
              id="clear-search"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted hover:bg-bg"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Field roster
          </h1>
          <Button asChild size="sm" className="gap-1.5 rounded-[10px] bg-pine hover:bg-pine/90 text-paper font-semibold shadow-sm">
            <Link to="/register">
              <Plus className="size-4" />
              Register
            </Link>
          </Button>
        </div>

        {/* Quick Navigation & Sync Bar */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Button
            id="btn-sync-clinic"
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncState === "syncing" || pendingCount === 0}
            className={`gap-1.5 h-8 rounded-[10px] text-xs transition-colors ${
              syncState === "done"
                ? "border-pine/50 text-pine"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            {syncState === "syncing" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CloudUpload className="size-3.5" />
            )}
            {syncState === "syncing"
              ? "Syncing…"
              : syncState === "done"
              ? "✓ Synced"
              : `Sync${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 rounded-[10px] border-line text-muted hover:text-ink gap-1 text-xs">
            <Link to="/schemes">
              🏥 Schemes
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 rounded-[10px] border-line text-muted hover:text-ink gap-1 text-xs">
            <Link to="/awareness">
              💡 Awareness
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 rounded-[10px] border-line text-muted hover:text-ink gap-1 text-xs">
            <Link to="/staff">
              👩‍⚕️ Staff
            </Link>
          </Button>
        </div>

        <ul className="mt-3 flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <li className="rounded-[20px] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-muted">
              {searchQuery
                ? `No patients match "${searchQuery}".`
                : "Roster is empty. Register a patient to begin."}
            </li>
          ) : (
            filtered.map((p) => <PatientRow key={p.id} patient={p} />)
          )}
        </ul>
      </main>
    </AppFrame>
  );
}

// ── Feature 2: Triage risk flag helper ──────────────────────────────────────
function scanNeedsFollowUp(scan: VitalsScan | null): boolean {
  if (!scan) return false;
  const triage = evaluateTriage({
    bpm: scan.heartRate,
    hrv: scan.hrvRmssd,
    spo2: scan.spo2Estimate,
    rr: scan.respiratoryRate,
  });
  return URGENT_TRIAGE_LEVELS.has(triage.level);
}

function PatientRow({ patient }: { patient: Patient }) {
  const db = useUnivolt((s) => s.db);
  const scan = latestScan(db, patient.id);
  const cough = latestCough(db, patient.id);

  const coughFollowUp = cough?.classification !== "Normal" && cough != null;
  // Feature 2: flag if latest vitals triage is a concerning level
  const vitalsFollowUp = scanNeedsFollowUp(scan);
  const needsFollowUp = coughFollowUp || vitalsFollowUp;

  const priority = getPriorityFromVitals({
    bpm: scan?.heartRate,
    spo2: scan?.spo2Estimate,
    rr: scan?.respiratoryRate,
    tempC: scan?.temperatureC,
    bpSys: scan?.bpSystolic,
    bpDia: scan?.bpDiastolic,
  });
  const meta = priorityMeta(priority);

  return (
    <li>
      <Link
        to="/patient/$id"
        params={{ id: patient.id }}
        className="block rounded-[20px] border border-line bg-paper p-4 no-underline transition-colors hover:border-pine/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* ── Feature 2: red warning icon + badge ── */}
            {needsFollowUp && (
              <span
                aria-label="Follow-up required"
                className="text-base leading-none"
                title="Vitals indicate follow-up required"
              >
                ⚠️
              </span>
            )}
            <div>
              <p className="text-[0.98rem] font-semibold text-ink">{patient.name}</p>
              <p className="mt-0.5 text-sm text-muted">
                {patient.village} · {patient.age}
                {patient.sex}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border flex items-center gap-1 ${meta.badgeBg} ${meta.badgeBorder} ${meta.textColor}`}>
                <span>{meta.emoji}</span>
                <span>{meta.labelEn}</span>
              </span>
              <Badge variant="muted">{patient.caseId}</Badge>
            </div>
            {needsFollowUp && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/30">
                Follow-up Required
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          <span>
            Last visit {formatDistanceToNow(patient.lastVisitAt, { addSuffix: true })}
          </span>
          {scan ? (
            <span className="font-medium tabular-nums text-ink">
              ❤️ {scan.heartRate} · 🫁 {scan.respiratoryRate} · 🩸 {scan.spo2Estimate}%
            </span>
          ) : (
            <span>No vitals yet</span>
          )}
        </div>
        {coughFollowUp ? (
          <p className="mt-2 text-[12px] font-medium text-warn">Cough screen flagged for follow-up</p>
        ) : null}
      </Link>
    </li>
  );
}
