import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { SavedLocalBadge } from "@/components/sync-indicator";
import { WaveformCanvas } from "@/components/waveform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PPG_DURATION_SEC,
  PPG_SAMPLE_RATE,
  nextSimulatedSample,
  processPpg,
} from "@/lib/univolt/ppgProcessor";
import { selectPatient, useUnivolt } from "@/lib/univolt/store";
import type { PpgResult } from "@/lib/univolt/types";

export const Route = createFileRoute("/patient/$id/scan")({ component: VitalsScanScreen });

type Phase = "idle" | "running" | "processing" | "done";

export function VitalsScanScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const addVitalsScan = useUnivolt((s) => s.addVitalsScan);
  const patient = selectPatient(db, id);

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(PPG_DURATION_SEC);
  const [result, setResult] = useState<PpgResult | null>(null);
  const [saved, setSaved] = useState(false);

  const samplesRef = useRef<number[]>([]);
  const phaseRef = useRef({ current: Math.random() });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
    };
  }, []);

  function runDemo() {
    if (phase === "running" || phase === "processing") return;
    samplesRef.current = [];
    phaseRef.current.current = Math.random();
    setResult(null);
    setSaved(false);
    setRemaining(PPG_DURATION_SEC);
    setPhase("running");

    const bpm = 65 + Math.random() * 30;
    const rrBpm = 11 + Math.random() * 10;
    const started = performance.now();
    const dt = 1 / PPG_SAMPLE_RATE;

    timerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      const targetCount = Math.min(PPG_DURATION_SEC * PPG_SAMPLE_RATE, Math.floor(elapsed * PPG_SAMPLE_RATE) + 1);
      while (samplesRef.current.length < targetCount) {
        const t = samplesRef.current.length * dt;
        samplesRef.current.push(nextSimulatedSample(t, bpm, rrBpm, phaseRef.current, dt));
      }
      const left = Math.max(0, Math.ceil(PPG_DURATION_SEC - elapsed));
      setRemaining(left);
      if (elapsed >= PPG_DURATION_SEC) {
        if (timerRef.current != null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setPhase("processing");
        window.setTimeout(() => {
          const processed = processPpg(samplesRef.current.slice(), PPG_SAMPLE_RATE);
          setResult(processed);
          setPhase("done");
          if (patient) {
            addVitalsScan(patient.id, processed, true);
            setSaved(true);
          }
        }, 700);
      }
    }, 40);
  }

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/patient/$id", params: { id: patient.id } }}
        title="Vitals scan"
        subtitle={patient.name}
      />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">
        <div className="overflow-hidden rounded-[24px] bg-monitor p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-trace/80">PPG monitor</p>
            {phase === "running" ? (
              <span className="font-display text-2xl tabular-nums text-paper">{remaining}s</span>
            ) : (
              <span className="text-[11px] text-trace/70">12s capture</span>
            )}
          </div>
          <WaveformCanvas samplesRef={samplesRef} className="h-40 w-full rounded-[16px]" />
          <p className="mt-2 px-1 text-[11px] text-trace/75">Demo signal (simulated for web preview)</p>
        </div>

        {phase === "idle" || phase === "running" ? (
          <p className="text-sm leading-relaxed text-muted">
            On a phone, this path samples the rear camera. In a desktop browser there is no torch or reliable
            fingertip PPG, so Univolt generates a noisy 65–95 BPM waveform and runs the same peak detector used on
            device.
          </p>
        ) : null}

        {phase !== "done" ? (
          <Button size="lg" onClick={runDemo} disabled={phase === "running" || phase === "processing"}>
            {phase === "running"
              ? `Sampling… ${remaining}s`
              : phase === "processing"
                ? "Detecting peaks…"
                : "Run 12s demo signal"}
          </Button>
        ) : null}

        {result && phase === "done" ? (
          <section className="rounded-[24px] border border-line bg-paper p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Scan result</h2>
              {saved ? <SavedLocalBadge /> : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Heart rate" value={`${result.heartRate}`} unit="bpm" />
              <Metric label="HRV (RMSSD)" value={`${result.hrvRmssd}`} unit="ms" />
              <Metric label="Estimated respiratory rate" value={`${result.respiratoryRate}`} unit="/min" />
              <Metric label="Estimated SpO2" value={`${result.spo2Estimate}`} unit="%" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="muted">Signal quality {result.signalQuality}%</Badge>
              <Badge variant="monitor">{result.peakCount} peaks</Badge>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Estimated SpO2 (screening only, not clinical-grade). True SpO2 needs red + infrared; this value is a
              perfusion-index heuristic clamped to 94–99%. Respiratory rate is estimated from 0.15–0.4 Hz modulation
              of the same red-channel intensity signal.
            </p>
            <Button asChild className="mt-4 w-full" size="lg">
              <Link to="/patient/$id" params={{ id: patient.id }}>
                Back to record
              </Link>
            </Button>
          </section>
        ) : null}
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
