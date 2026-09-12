import { useEffect, useState } from "react";
import { Line, LineChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import type { VitalsScan } from "@/lib/univolt/types";
import { format } from "date-fns";

// ── Per-chart data point types ────────────────────────────────────────────────

type HrPoint  = { t: string; hr: number };
type RrPoint  = { t: string; rr: number };
type Spo2Point = { t: string; spo2: number; manual: boolean };

// ── Existing multi-vital spark (unchanged API for callers that use it) ────────

export function TrendChart({ scans }: { scans: VitalsScan[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // For the old combined chart we keep using camera scan data (backwards-compat).
  const cameraScans = scans.filter((s) => !s.source || s.source === "scan");

  if (cameraScans.length < 2) {
    return (
      <p className="px-1 py-6 text-sm text-muted">
        Charts appear after two or more scans. Run a vitals capture to start a trend.
      </p>
    );
  }

  if (!ready) {
    return <div className="h-52 rounded-[16px] bg-paper" />;
  }

  const data = cameraScans.map((s) => ({
    t: format(s.capturedAt, "d MMM"),
    hr: s.heartRate,
    rr: s.respiratoryRate,
    spo2: s.spo2Estimate,
  }));

  return (
    <div className="flex flex-col gap-3">
      <OldSpark data={data} dataKey="hr"   color="var(--color-pine)" label="Heart rate"           unit=" bpm" />
      <OldSpark data={data} dataKey="rr"   color="var(--color-warn)" label="Est. respiratory rate" unit="/min" />
      <OldSpark data={data} dataKey="spo2" color="var(--color-moss)" label="Est. SpO₂"             unit="%" />
    </div>
  );
}

function OldSpark({ data, dataKey, color, label, unit }: {
  data: { t: string; hr: number; rr: number; spo2: number }[];
  dataKey: "hr" | "rr" | "spo2";
  color: string;
  label: string;
  unit: string;
}) {
  const last = data[data.length - 1]?.[dataKey];
  const first = data[0]?.[dataKey];
  const delta = last != null && first != null ? last - first : 0;
  const deltaLabel = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-muted">{label}</p>
        <p className="text-[12px] font-medium tabular-nums text-ink">
          {last}{unit}
          <span className="ml-1.5 text-faint">{deltaLabel}</span>
        </p>
      </div>
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 2 }}>
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0, fill: color }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── New standalone per-vital charts (used by the enhanced patient detail page) ─

/** Heart rate trend from camera scan data only. */
export function HrChart({ scans, windowDays }: { scans: VitalsScan[]; windowDays: 7 | 30 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const cutoff = Date.now() - windowDays * 86_400_000;
  const filtered = scans.filter((s) => s.capturedAt >= cutoff && (!s.source || s.source === "scan"));
  if (!ready) return <div className="h-20 rounded-[12px] bg-surface" />;
  if (filtered.length < 1) return <p className="text-sm text-muted py-3">No data in this window.</p>;
  const data: HrPoint[] = filtered.map((s) => ({ t: format(s.capturedAt, "d MMM"), hr: s.heartRate }));
  return <SingleLineChart data={data} dataKey="hr" color="var(--color-pine)" unit=" bpm" label="bpm" />;
}

/** Respiratory rate trend from camera scan data only. */
export function RrChart({ scans, windowDays }: { scans: VitalsScan[]; windowDays: 7 | 30 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const cutoff = Date.now() - windowDays * 86_400_000;
  const filtered = scans.filter((s) => s.capturedAt >= cutoff && (!s.source || s.source === "scan"));
  if (!ready) return <div className="h-20 rounded-[12px] bg-surface" />;
  if (filtered.length < 1) return <p className="text-sm text-muted py-3">No data in this window.</p>;
  const data: RrPoint[] = filtered.map((s) => ({ t: format(s.capturedAt, "d MMM"), rr: s.respiratoryRate }));
  return <SingleLineChart data={data} dataKey="rr" color="var(--color-warn)" unit="/min" label="/min" />;
}

/** SpO₂ chart from MANUAL entries only — camera rPPG spo2 is excluded for honesty. */
export function Spo2Chart({ scans, windowDays }: { scans: VitalsScan[]; windowDays: 7 | 30 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const cutoff = Date.now() - windowDays * 86_400_000;
  const manual = scans.filter((s) => s.capturedAt >= cutoff && s.source === "manual");
  if (!ready) return <div className="h-20 rounded-[12px] bg-surface" />;
  if (manual.length === 0) return null; // caller handles empty state
  const data: Spo2Point[] = manual.map((s) => ({
    t: format(s.capturedAt, "d MMM"),
    spo2: s.spo2Estimate,
    manual: true,
  }));
  return <SingleLineChart data={data} dataKey="spo2" color="var(--color-moss)" unit="%" label="%" manualDots />;
}

function SingleLineChart({
  data,
  dataKey,
  color,
  unit,
  label,
  manualDots,
}: {
  data: (HrPoint | RrPoint | Spo2Point)[];
  dataKey: string;
  color: string;
  unit: string;
  label: string;
  manualDots?: boolean;
}) {
  const values = data.map((d) => (d as Record<string, unknown>)[dataKey] as number).filter(Boolean);
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 2 }}>
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} />
          <YAxis domain={[min, max]} tick={{ fontSize: 10, fill: "var(--color-faint)" }} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            contentStyle={{ background: "var(--color-paper)", border: "1px solid var(--color-line)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [`${v}${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            dot={manualDots
              ? { r: 4, strokeWidth: 2, stroke: color, fill: "var(--color-paper)" }
              : { r: 3, strokeWidth: 0, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
