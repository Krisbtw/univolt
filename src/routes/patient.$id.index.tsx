import { Link, createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, Mic } from "lucide-react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { SavedLocalBadge } from "@/components/sync-indicator";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { latestCough, selectCoughs, selectPatient, selectScans, useUnivolt } from "@/lib/univolt/store";

export const Route = createFileRoute("/patient/$id/")({ component: PatientProfileScreen });

function PatientProfileScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const patient = selectPatient(db, id);
  const scans = selectScans(db, id);
  const coughs = selectCoughs(db, id);
  const lastCough = latestCough(db, id);

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
        <p className="px-4 pt-6 text-sm text-muted">This record is not on this device.</p>
      </AppFrame>
    );
  }

  const lastScan = scans[scans.length - 1];

  return (
    <AppFrame>
      <AppHeader back={{ to: "/" }} />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">
        <div className="rounded-[24px] border border-line bg-paper p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[1.7rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
                {patient.name}
              </h1>
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

        {lastScan ? (
          <section className="rounded-[24px] border border-line bg-paper p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Latest vitals</h2>
              <SavedLocalBadge />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Heart rate" value={`${lastScan.heartRate}`} unit="bpm" />
              <Metric label="HRV (RMSSD)" value={`${lastScan.hrvRmssd}`} unit="ms" />
              <Metric label="Est. respiratory rate" value={`${lastScan.respiratoryRate}`} unit="/min" />
              <Metric label="Est. SpO2" value={`${lastScan.spo2Estimate}`} unit="%" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Estimated SpO2 is screening only, not clinical-grade. A single RGB camera cannot replace red + infrared
              pulse oximetry.
            </p>
            <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
              <span>Signal quality {lastScan.signalQuality}%</span>
              <span>{format(lastScan.capturedAt, "d MMM, HH:mm")}</span>
            </div>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-line bg-paper p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Trend</h2>
            <p className="text-[11px] text-faint">HR · RR · SpO2</p>
          </div>
          <TrendChart scans={scans} />
        </section>

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
              {coughs
                .slice()
                .reverse()
                .slice(0, 4)
                .map((c) => (
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
