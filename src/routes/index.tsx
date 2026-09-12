import { Link, createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { latestCough, latestScan, useUnivolt } from "@/lib/univolt/store";
import type { Patient } from "@/lib/univolt/types";

export const Route = createFileRoute("/")({ component: HomeScreen });

function HomeScreen() {
  const db = useUnivolt((s) => s.db);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = [...db.patients].sort((a, b) => b.lastVisitAt - a.lastVisitAt);
    if (!q) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.caseId.toLowerCase().includes(q),
    );
  }, [db.patients, searchQuery]);

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

        <div className="mt-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Field roster
          </h1>
          <Button asChild size="sm">
            <Link to="/register">
              <Plus className="size-4" />
              Register
            </Link>
          </Button>
        </div>

        <ul className="mt-3 flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <li className="rounded-[20px] border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-muted">
              {searchQuery
                ? `No patients match “${searchQuery}”.`
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

function PatientRow({ patient }: { patient: Patient }) {
  const db = useUnivolt((s) => s.db);
  const scan = latestScan(db, patient.id);
  const cough = latestCough(db, patient.id);
  const followUp = cough?.classification !== "Normal" && cough != null;

  return (
    <li>
      <Link
        to="/patient/$id"
        params={{ id: patient.id }}
        className="block rounded-[20px] border border-line bg-paper p-4 no-underline transition-colors hover:border-pine/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.98rem] font-semibold text-ink">{patient.name}</p>
            <p className="mt-0.5 text-sm text-muted">
              {patient.village} · {patient.age}
              {patient.sex}
            </p>
          </div>
          <Badge variant="muted">{patient.caseId}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          <span>
            Last visit {formatDistanceToNow(patient.lastVisitAt, { addSuffix: true })}
          </span>
          {scan ? (
            <span className="font-medium tabular-nums text-ink">
              HR {scan.heartRate} · RR {scan.respiratoryRate} · SpO2 {scan.spo2Estimate}%
            </span>
          ) : (
            <span>No vitals yet</span>
          )}
        </div>
        {followUp ? (
          <p className="mt-2 text-[12px] font-medium text-warn">Cough screen flagged for follow-up</p>
        ) : null}
      </Link>
    </li>
  );
}
