import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { evaluateFusion, type FusionLevel, type FusionReason } from "../lib/fusionEngine";
import { useFusionSession } from "../lib/fusionStore";
import { classifyFet } from "../lib/breathAudioEngine";
import { getStrings } from "../lib/translations";
import { loadLocale } from "../lib/vitalsDatabase";

// ── Reason code → human-readable label ────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
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

function labelFor(reason: FusionReason, spo2UrgentReason: string, spo2LowReason: string): string {
  if (reason.code === "spo2_urgent") return spo2UrgentReason;
  if (reason.code === "spo2_low") return spo2LowReason;
  return REASON_LABELS[reason.code] ?? reason.code;
}

// ── Level styling ─────────────────────────────────────────────────────────────

function levelConfig(level: FusionLevel): {
  bgClass: string;
  borderClass: string;
  textClass: string;
  emoji: string;
  label: string;
} {
  switch (level) {
    case "urgent":
      return {
        bgClass: "bg-red-500/10",
        borderClass: "border-red-500/30",
        textClass: "text-red-700 dark:text-red-400",
        emoji: "🚨",
        label: "URGENT — Go to Hospital Now",
      };
    case "phc_today":
      return {
        bgClass: "bg-amber-500/10",
        borderClass: "border-amber-500/30",
        textClass: "text-amber-800 dark:text-amber-400",
        emoji: "⚠️",
        label: "Visit PHC Today",
      };
    case "self_care":
      return {
        bgClass: "bg-emerald-500/10",
        borderClass: "border-emerald-500/30",
        textClass: "text-emerald-800 dark:text-emerald-400",
        emoji: "✅",
        label: "Self-Care & Routine Monitoring",
      };
    case "insufficient_data":
      return {
        bgClass: "bg-surface",
        borderClass: "border-line",
        textClass: "text-muted",
        emoji: "ℹ️",
        label: "Insufficient Data",
      };
  }
}

// ── Fusion Screen ─────────────────────────────────────────────────────────────

export function FusionScreen() {
  const session = useFusionSession();
  const t = useMemo(() => getStrings(loadLocale() ?? "en"), []);

  // Local questionnaire state
  const [age, setAge] = useState(session.ageYears?.toString() ?? "");
  const [pregnant, setPregnant] = useState(session.pregnant ?? false);
  const [breathless, setBreathless] = useState(session.symptoms?.breathless ?? false);
  const [chestPain, setChestPain] = useState(session.symptoms?.chestPain ?? false);
  const [fainting, setFainting] = useState(session.symptoms?.fainting ?? false);
  const [bleeding, setBleeding] = useState(session.symptoms?.bleeding ?? false);
  const [feverDays, setFeverDays] = useState(session.symptoms?.feverDays?.toString() ?? "");

  // Build inputs live
  const inputs = useMemo(
    () => ({
      ageYears: age ? parseInt(age, 10) : undefined,
      pregnant,
      symptoms: {
        breathless,
        chestPain,
        fainting,
        bleeding,
        feverDays: feverDays ? parseInt(feverDays, 10) : undefined,
      },
      rppg: session.rppg,
      spo2: session.spo2,
      crtSec: session.crtSec,
      fetSec: session.fetSec,
    }),
    [
      age,
      pregnant,
      breathless,
      chestPain,
      fainting,
      bleeding,
      feverDays,
      session.rppg,
      session.spo2,
      session.crtSec,
      session.fetSec,
    ],
  );

  const result = useMemo(() => evaluateFusion(inputs), [inputs]);
  const lc = levelConfig(result.level);
  const fetClass = session.fetSec != null ? classifyFet(session.fetSec) : null;

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/" }}
        title="Triage Summary"
        subtitle="Multimodal Signal Assessment"
      />

      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-4">
        {/* Triage Level Card */}
        <div
          className={`flex items-center gap-3.5 rounded-[20px] p-4 border ${lc.bgClass} ${lc.borderClass} ${lc.textClass}`}
        >
          <span className="text-3xl leading-none">{lc.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-base font-bold leading-tight">{lc.label}</p>
            <p className="text-xs opacity-80 mt-0.5">
              {result.signalsUsed} signal{result.signalsUsed !== 1 ? "s" : ""} collected
            </p>
          </div>
        </div>

        {/* Collected signals */}
        <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Collected Signals
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <SignalBadge
              label="rPPG Heart Rate"
              value={
                session.rppg?.bpm != null
                  ? `${session.rppg.bpm} bpm`
                  : session.rppg
                  ? "No HR"
                  : "Not measured"
              }
              quality={session.rppg ? session.rppg.quality : "reject"}
            />
            <SignalBadge
              label="Blood Oxygen (SpO₂)"
              value={
                session.spo2?.value != null
                  ? `${session.spo2.value}%`
                  : session.spo2
                  ? t.unableToDetect
                  : "Not measured"
              }
              quality={session.spo2 ? session.spo2.quality : "reject"}
            />
            <SignalBadge
              label="Breathing (FET)"
              value={session.fetSec != null ? `${session.fetSec.toFixed(1)} s` : "Not measured"}
              quality={
                session.fetSec != null
                  ? fetClass === "reject"
                    ? "reject"
                    : fetClass === "obstruction"
                    ? "weak"
                    : "good"
                  : "reject"
              }
            />
            <SignalBadge
              label="Capillary Refill (CRT)"
              value={session.crtSec != null ? `${session.crtSec.toFixed(1)} s` : "Not measured"}
              quality={session.crtSec != null ? "good" : "reject"}
            />
          </div>
        </div>

        {/* Questionnaire */}
        <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-3 text-ink">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Intake Questionnaire
          </h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">Age (years)</label>
            <input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="--"
              inputMode="numeric"
              className="rounded-[12px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-pine"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-ink cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={pregnant}
              onChange={(e) => setPregnant(e.target.checked)}
              className="size-4 accent-pine rounded"
            />
            Currently pregnant
          </label>

          <div className="pt-2 border-t border-line/60 flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              Reported Symptoms
            </p>
            {(
              [
                ["breathless", "Breathlessness / Shortness of breath", breathless, setBreathless],
                ["chestPain", "Chest pain or tightness", chestPain, setChestPain],
                ["fainting", "Fainting / loss of consciousness", fainting, setFainting],
                ["bleeding", "Active bleeding (external)", bleeding, setBleeding],
              ] as const
            ).map(([, sym, val, set]) => (
              <label
                key={sym}
                className="flex items-center gap-2.5 text-xs font-medium text-ink cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={val as boolean}
                  onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
                  className="size-4 accent-pine rounded"
                />
                {sym}
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <label className="text-xs font-semibold text-muted">Days of fever</label>
            <input
              type="number"
              min={0}
              max={30}
              value={feverDays}
              onChange={(e) => setFeverDays(e.target.value)}
              placeholder="0"
              inputMode="numeric"
              className="rounded-[12px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-pine"
            />
          </div>
        </div>

        {/* Reasons */}
        {result.reasons.length > 0 && (
          <div className="rounded-[20px] border border-line bg-paper p-4 flex flex-col gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              Assessment Findings
            </h2>
            <ul className="flex flex-col gap-1.5">
              {result.reasons.map((r) => (
                <li key={r.code} className="flex items-center gap-2 text-xs font-medium text-ink">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      r.weight >= 10
                        ? "bg-red-500"
                        : r.weight >= 5
                        ? "bg-amber-500"
                        : "bg-pine"
                    }`}
                  />
                  {labelFor(r, t.spo2UrgentReason, t.spo2LowReason)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Applicable health schemes link */}
        {(result.level === "urgent" || result.level === "phc_today") && (
          <div className="text-center py-1">
            <Link
              to="/schemes"
              className="text-xs font-semibold text-pine hover:underline inline-flex items-center gap-1"
            >
              {t.schemesLinkFromFusion ?? "See applicable government health schemes →"}
            </Link>
          </div>
        )}

        {/* Test Navigation Row */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Link to="/fet" className="w-full">
              <Button variant="secondary" className="w-full text-xs font-semibold">
                🫁 Breathing Test
              </Button>
            </Link>
            <Link to="/crt" className="w-full">
              <Button variant="secondary" className="w-full text-xs font-semibold">
                💅 CRT Test
              </Button>
            </Link>
          </div>
          <Link to="/referral" className="w-full">
            <Button
              id="btn-goto-referral-slip"
              variant="default"
              className="w-full text-xs font-semibold gap-1.5"
            >
              📋 Generate Referral Slip →
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-muted text-center leading-relaxed">
          Not a medical device. For screening and clinical decision support only.
        </p>
      </main>
    </AppFrame>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SignalBadge({
  label,
  value,
  quality,
}: {
  label: string;
  value: string;
  quality: "good" | "weak" | "reject" | "manual";
}) {
  const badgeColor =
    quality === "good" || quality === "manual"
      ? "text-pine bg-pine/10 border-pine/30"
      : quality === "weak"
      ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
      : "text-muted bg-surface border-line";

  return (
    <div className="rounded-[14px] border border-line bg-surface p-3 flex flex-col gap-1">
      <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-ink truncate">{value}</p>
      <span
        className={`inline-block w-fit text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[6px] border ${badgeColor}`}
      >
        {quality}
      </span>
    </div>
  );
}
