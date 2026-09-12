import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { SavedLocalBadge } from "@/components/sync-indicator";
import { StaticWaveform } from "@/components/waveform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  COUGH_DURATION_SEC,
  analyzeCoughPcm,
  downsampleTrace,
  generateMockCoughResult,
  recordCoughAudio,
} from "@/lib/univolt/coughProcessor";
import { NonSpeakingNote } from "@/components/communication/non-speaking-note";
import { selectPatient, useUnivolt } from "@/lib/univolt/store";
import { getStrings } from "@/lib/translations";
import { loadLocale } from "@/lib/vitalsDatabase";
import type { CoughResult } from "@/lib/univolt/types";

export const Route = createFileRoute("/patient/$id/cough")({ component: CoughScreen });

type Phase = "idle" | "recording" | "processing" | "done";

export function CoughScreen() {
  const { id } = Route.useParams();
  const db = useUnivolt((s) => s.db);
  const addCoughScreening = useUnivolt((s) => s.addCoughScreening);
  const patient = selectPatient(db, id);

  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(COUGH_DURATION_SEC);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<CoughResult | null>(null);
  const [trace, setTrace] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const cancelRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  function finishCapture(next: CoughResult, samples: number[], runId: number) {
    if (runId !== runIdRef.current) return;
    setTrace(samples);
    setResult(next);
    setPhase("done");
    setLevel(0);
    if (patient) {
      addCoughScreening(patient.id, next);
      setSaved(true);
    }
  }

  function runMockCapture(runId: number) {
    const mock = generateMockCoughResult("normal");
    const started = performance.now();
    const tick = window.setInterval(() => {
      if (runId !== runIdRef.current) {
        window.clearInterval(tick);
        return;
      }
      const elapsed = (performance.now() - started) / 1000;
      setRemaining(Math.max(0, Math.ceil(COUGH_DURATION_SEC - elapsed)));
      const frac = Math.min(1, elapsed / COUGH_DURATION_SEC);
      const n = Math.max(2, Math.floor(frac * mock.samples.length));
      setTrace(downsampleTrace(mock.samples.slice(0, n)));
      setLevel(0.08 + 0.12 * Math.abs(Math.sin(elapsed * 3.1)));
      if (elapsed >= COUGH_DURATION_SEC) {
        window.clearInterval(tick);
        setPhase("processing");
        window.setTimeout(() => {
          finishCapture(mock.result, downsampleTrace(mock.samples), runId);
        }, 350);
      }
    }, 100);
  }

  async function runScreen() {
    if (phase === "recording" || phase === "processing") return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setResult(null);
    setSaved(false);
    setTrace([]);
    setRemaining(COUGH_DURATION_SEC);
    setLevel(0);
    setPhase("recording");

    // Real mic is only worth attempting where getUserMedia exists at all —
    // otherwise skip straight to the mock so we don't burn the countdown on
    // an API call we already know will resolve to null.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRemaining(COUGH_DURATION_SEC);
      runMockCapture(runId);
      return;
    }

    const started = performance.now();
    const countdown = window.setInterval(() => {
      if (runId !== runIdRef.current) {
        window.clearInterval(countdown);
        return;
      }
      const elapsed = (performance.now() - started) / 1000;
      setRemaining(Math.max(0, Math.ceil(COUGH_DURATION_SEC - elapsed)));
    }, 100);

    const captured = await recordCoughAudio(COUGH_DURATION_SEC, (rms) => {
      if (runId !== runIdRef.current) return;
      setLevel(rms);
    });

    window.clearInterval(countdown);
    if (runId !== runIdRef.current) return;

    if (!captured) {
      // Permission denied, no microphone, or the API timed out — fall back
      // to the demo waveform + canned result rather than leaving the screen
      // stuck.
      setRemaining(COUGH_DURATION_SEC);
      setLevel(0);
      runMockCapture(runId);
      return;
    }

    setPhase("processing");
    window.setTimeout(() => {
      if (runId !== runIdRef.current) return;
      const result = analyzeCoughPcm(captured.samples, captured.sampleRate);
      finishCapture(result, downsampleTrace(captured.samples), runId);
    }, 350);
  }

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
      </AppFrame>
    );
  }

  const flagged = result && result.classification !== "Normal";

  return (
    <AppFrame>
      <AppHeader back={{ to: "/patient/$id", params: { id: patient.id } }} title="Cough screening" subtitle={patient.name} />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-3">
        {/* Note only — never blocks the test. */}
        <NonSpeakingNote patient={patient} t={getStrings(loadLocale() ?? "en")} />
        <div className="rounded-[24px] border border-line bg-paper p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Prototype heuristic — not a diagnostic classifier
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Captures about {COUGH_DURATION_SEC} seconds of microphone audio, then scores zero-crossing rate and
            short-time energy variance. If the browser blocks the microphone, a demo waveform and canned result are
            used instead.
          </p>
          <div className="mt-4 h-20 overflow-hidden rounded-[16px] bg-surface">
            {trace.length > 1 ? (
              <StaticWaveform samples={trace} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center px-4">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-pine transition-[width] duration-150"
                    style={{ width: `${Math.min(100, Math.max(4, level * 280))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          {phase === "recording" ? (
            <p className="mt-2 text-sm font-medium tabular-nums text-pine">Recording {remaining}s</p>
          ) : null}
        </div>

        {phase !== "done" ? (
            <Button size="lg" onClick={() => runScreen()} disabled={phase === "recording" || phase === "processing"}>
              {phase === "recording"
                ? `Hold near mouth… ${remaining}s`
                : phase === "processing"
                  ? "Scoring envelope…"
                  : "Capture 6s audio sample"}
            </Button>
        ) : null}

        {result && phase === "done" ? (
          <section className="rounded-[24px] border border-line bg-paper p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Screening result</h2>
              {saved ? <SavedLocalBadge /> : null}
            </div>
            <Badge variant={flagged ? "warn" : "ok"}>{flagged ? "Follow-up" : "Normal"}</Badge>
            <p className="mt-3 text-[1.05rem] font-medium leading-snug text-ink">{result.classification}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-[16px] bg-surface px-3 py-2">
                <dt className="text-muted">Zero-crossing rate</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink">{result.zeroCrossingRate} /s</dd>
              </div>
              <div className="rounded-[16px] bg-surface px-3 py-2">
                <dt className="text-muted">Energy variance</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink">
                  {result.energyVariance < 0.001
                    ? result.energyVariance.toExponential(1)
                    : result.energyVariance.toFixed(4)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">{result.notes}</p>
            {result.simulated ? (
              <p className="mt-2 text-[11px] font-medium text-warn">Microphone unavailable — demo audio used.</p>
            ) : null}
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
