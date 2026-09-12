import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { VitalsScan } from "@/lib/univolt/types";
import { format } from "date-fns";

type Point = {
  t: string;
  hr: number;
  rr: number;
  spo2: number;
};

export function TrendChart({ scans }: { scans: VitalsScan[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const data: Point[] = scans.map((s) => ({
    t: format(s.capturedAt, "d MMM"),
    hr: s.heartRate,
    rr: s.respiratoryRate,
    spo2: s.spo2Estimate,
  }));

  if (scans.length < 2) {
    return (
      <p className="px-1 py-6 text-sm text-muted">
        Charts appear after two or more scans. Run a vitals capture to start a trend.
      </p>
    );
  }

  if (!ready) {
    return <div className="h-52 rounded-[16px] bg-paper" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Spark data={data} dataKey="hr" color="var(--color-pine)" label="Heart rate" unit=" bpm" />
      <Spark data={data} dataKey="rr" color="var(--color-warn)" label="Est. respiratory rate" unit="/min" />
      <Spark data={data} dataKey="spo2" color="var(--color-moss)" label="Est. SpO2" unit="%" />
    </div>
  );
}

function Spark({
  data,
  dataKey,
  color,
  label,
  unit,
}: {
  data: Point[];
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
          {last}
          {unit}
          <span className="ml-1.5 text-faint">{deltaLabel}</span>
        </p>
      </div>
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 2 }}>
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0, fill: color }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
