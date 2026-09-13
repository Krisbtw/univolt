/**
 * /patient/$id/intake — Gesture-mode triage intake questionnaire.
 *
 * When patient.canSpeak === false, questions are shown one-at-a-time with:
 * - Large text + icon
 * - TTS auto-read (if !canRead)
 * - Gesture recognition: 👍 = YES, 👎 = NO (held ~0.5 s)
 * - NON-NEGOTIABLE fallback: big tappable YES / NO buttons always visible
 * - Hint after 4 s of no gesture: "you can tap instead"
 *
 * When patient.canSpeak, shows a simpler tap-based form.
 * All answers write into fusionStore.setQuestionnaire().
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  GESTURE_HOLD_FRAMES,
  loadGestureRecognizer,
  recognizeGesture,
} from "@/lib/gestureRecognizer";
import { useFusionSession } from "@/lib/fusionStore";
import { getStrings, type Locale, type Strings } from "@/lib/translations";
import { loadLocale, saveLocale } from "@/lib/vitalsDatabase";
import { communicationProfile, selectPatient, useUnivolt } from "@/lib/univolt/store";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

export const Route = createFileRoute("/patient/$id/intake")({
  component: IntakeScreen,
});

// ── Age-band → approximate years mapping ─────────────────────────────────────
const AGE_BAND_YEARS = [6, 14, 38, 67, 80] as const;

// ── Question set ──────────────────────────────────────────────────────────────
type QuestionId =
  | "breathless"
  | "chestPain"
  | "fainting"
  | "bleeding"
  | "fever"
  | "feverDays"
  | "ageBand"
  | "pregnant";

interface YesNoQuestion {
  kind: "yesno";
  id: QuestionId;
  icon: string;
  textKey: keyof Strings;
}
interface AgeBandQuestion {
  kind: "ageband";
  id: QuestionId;
  icon: string;
  textKey: keyof Strings;
}
type Question = YesNoQuestion | AgeBandQuestion;

const QUESTIONS: Question[] = [
  { kind: "yesno", id: "breathless", icon: "🌬️", textKey: "intakeQBreathless" },
  { kind: "yesno", id: "chestPain", icon: "🫀", textKey: "intakeQChestPain" },
  { kind: "yesno", id: "fainting", icon: "💫", textKey: "intakeQFainting" },
  { kind: "yesno", id: "bleeding", icon: "🩸", textKey: "intakeQBleeding" },
  { kind: "yesno", id: "fever", icon: "🤒", textKey: "intakeQFever" },
  // feverDays is conditionally inserted after fever === true
  { kind: "ageband", id: "ageBand", icon: "👤", textKey: "intakeQAgeBand" },
  { kind: "yesno", id: "pregnant", icon: "🤰", textKey: "intakeQPregnant" },
];

const FRAME_INTERVAL_MS = 1000 / 30;
const NO_GESTURE_HINT_MS = 4000;

function IntakeScreen() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const db = useUnivolt((s) => s.db);
  const updateCommunicationProfile = useUnivolt((s) => s.updateCommunicationProfile);
  const setQuestionnaire = useFusionSession((s) => s.setQuestionnaire);
  const patient = selectPatient(db, id);

  const [locale, setLocale] = useState<Locale>(() => loadLocale() ?? "en");
  const t: Strings = useMemo(() => getStrings(locale), [locale]);
  useEffect(() => { saveLocale(locale); }, [locale]);

  // ── Communication needs step (Step 0) ─────────────────────────────────────
  const [step, setStep] = useState<"comm" | "questions">("comm");
  const [canSpeak, setCanSpeak] = useState(() => patient?.canSpeak ?? true);
  const [canHear, setCanHear] = useState(() => patient?.canHear ?? true);
  const [canRead, setCanRead] = useState(() => patient?.canRead ?? true);

  // ── Answers ────────────────────────────────────────────────────────────────
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, boolean | number>>>({});
  const [questionIdx, setQuestionIdx] = useState(0);

  // Build the active question list (insert feverDays after fever=true)
  const activeQuestions = useMemo<Question[]>(() => {
    const list: Question[] = [];
    for (const q of QUESTIONS) {
      list.push(q);
      if (q.id === "fever" && answers.fever === true) {
        list.push({ kind: "yesno", id: "feverDays", icon: "📅", textKey: "intakeQFeverDays" });
      }
    }
    // Only show pregnant for female patients
    return list.filter((q) => {
      if (q.id === "pregnant" && patient?.sex !== "F") return false;
      return true;
    });
  }, [answers.fever, patient?.sex]);

  const currentQ = activeQuestions[questionIdx];

  // ── Gesture recognizer ────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const streakRef = useRef<{ key: string | null; frames: number }>({ key: null, frames: 0 });
  const lastAnswerTimeRef = useRef(0);
  const lastGestureTimeRef = useRef(performance.now());

  const [gestureStatus, setGestureStatus] = useState<
    "idle" | "loading" | "running" | "unavailable" | "blocked"
  >("idle");
  const [showGestureHint, setShowGestureHint] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const { speak } = useSpeechSynthesis(locale);

  // Auto-read question via TTS when !canRead
  useEffect(() => {
    if (!canRead && currentQ && step === "questions") {
      speak(t[currentQ.textKey] as string);
    }
  }, [questionIdx, step, canRead, currentQ, speak, t]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    streakRef.current = { key: null, frames: 0 };
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const answerQuestion = useCallback(
    (answer: boolean | number) => {
      const now = performance.now();
      if (now - lastAnswerTimeRef.current < 1200) return; // debounce
      lastAnswerTimeRef.current = now;

      if (!currentQ) return;
      setAnswers((prev) => ({ ...prev, [currentQ.id]: answer }));

      // Confirmation flash
      const label =
        typeof answer === "boolean"
          ? answer
            ? t.intakeYes
            : t.intakeNo
          : String(answer);
      setConfirmation(label);
      setTimeout(() => {
        setConfirmation(null);
        setQuestionIdx((i) => i + 1);
      }, 900);
    },
    [currentQ, t],
  );

  // Gesture loop
  const gestureLoop = useCallback(() => {
    rafRef.current = requestAnimationFrame(gestureLoop);
    const video = videoRef.current;
    const recognizer = recognizerRef.current;
    if (!video || !recognizer || video.readyState < 2) return;

    const now = performance.now();
    if (now - lastFrameAtRef.current < FRAME_INTERVAL_MS) return;
    lastFrameAtRef.current = now;

    const frame = recognizeGesture(recognizer, video, now);
    if (!frame) return;

    const key =
      frame.gesture === "Thumb_Up"
        ? "yes"
        : frame.gesture === "Thumb_Down"
        ? "no"
        : null;

    if (key !== null) lastGestureTimeRef.current = now;

    if (key === null) {
      streakRef.current = { key: null, frames: 0 };
      // Show hint if no gesture for 4 s
      if (now - lastGestureTimeRef.current > NO_GESTURE_HINT_MS) {
        setShowGestureHint(true);
      }
      return;
    }
    setShowGestureHint(false);

    if (streakRef.current.key === key) {
      streakRef.current.frames += 1;
    } else {
      streakRef.current = { key, frames: 1 };
    }

    if (streakRef.current.frames === GESTURE_HOLD_FRAMES) {
      streakRef.current = { key: null, frames: 0 };
      answerQuestion(key === "yes");
    }
  }, [answerQuestion]);

  const startGestureCamera = useCallback(async () => {
    setGestureStatus("loading");
    const recognizer = await loadGestureRecognizer();
    if (!recognizer) {
      setGestureStatus("unavailable");
      return;
    }
    recognizerRef.current = recognizer;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setGestureStatus("running");
      lastGestureTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(gestureLoop);
    } catch {
      setGestureStatus("blocked");
    }
  }, [gestureLoop]);

  // ── Save and navigate ─────────────────────────────────────────────────────
  const saveAndFinish = useCallback(() => {
    // Update communication profile
    updateCommunicationProfile(id, { canSpeak, canHear, canRead });

    // Map answers → fusion questionnaire
    const hasFever = answers.fever === true;
    const fever3plus = answers.feverDays === true;
    const ageBandIdx = typeof answers.ageBand === "number" ? answers.ageBand : 2;
    const ageYears = AGE_BAND_YEARS[ageBandIdx] ?? 38;

    setQuestionnaire({
      ageYears,
      pregnant: answers.pregnant === true,
      symptoms: {
        breathless: answers.breathless === true,
        chestPain: answers.chestPain === true,
        fainting: answers.fainting === true,
        bleeding: answers.bleeding === true,
        feverDays: hasFever ? (fever3plus ? 3 : 1) : 0,
      },
    });

    void navigate({ to: "/patient/$id", params: { id } });
  }, [id, canSpeak, canHear, canRead, answers, navigate, updateCommunicationProfile, setQuestionnaire]);

  // Auto-finish when last question answered
  useEffect(() => {
    if (step === "questions" && questionIdx >= activeQuestions.length && activeQuestions.length > 0) {
      saveAndFinish();
    }
  }, [questionIdx, activeQuestions.length, step, saveAndFinish]);

  if (!patient) {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/" }} title="Patient not found" />
        <main className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted">Patient not found.</p>
        </main>
      </AppFrame>
    );
  }

  // ── Step 0: Communication needs ───────────────────────────────────────────
  if (step === "comm") {
    return (
      <AppFrame>
        <AppHeader back={{ to: "/patient/$id", params: { id } }} title={t.intakeTitle} />
        <main className="flex flex-1 flex-col gap-6 px-4 pb-10 pt-4">
          {/* Locale switcher */}
          <div className="flex gap-1 self-end rounded-[10px] bg-surface p-0.5">
            {(["en", "hi"] as Locale[]).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                className={`rounded-[8px] px-2.5 py-1 text-[11px] font-medium ${
                  locale === loc ? "bg-pine text-paper" : "text-muted"
                }`}
              >
                {loc === "en" ? t.localeNameEn : t.localeNameHi}
              </button>
            ))}
          </div>

          <div>
            <h2 className="font-display text-[1.4rem] font-semibold text-ink">
              {t.intakeCommStep}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.intakeCommHint}</p>
          </div>

          {/* Toggle chips */}
          <div className="flex flex-col gap-3">
            {[
              { label: t.intakeCanSpeak, value: canSpeak, set: setCanSpeak },
              { label: t.intakeCanHear, value: canHear, set: setCanHear },
              { label: t.intakeCanRead, value: canRead, set: setCanRead },
            ].map(({ label, value, set }) => (
              <button
                key={label}
                type="button"
                onClick={() => set(!value)}
                className={`flex items-center justify-between rounded-[16px] border px-4 py-3.5 text-left transition-colors ${
                  value
                    ? "border-pine/50 bg-pine/10 text-ink"
                    : "border-line bg-surface text-muted"
                }`}
              >
                <span className="text-base font-medium">{label}</span>
                <span
                  className={`size-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    value
                      ? "border-pine bg-pine text-paper"
                      : "border-line bg-paper text-muted"
                  }`}
                >
                  {value ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>

          <Button
            id="btn-intake-next"
            size="lg"
            className="mt-2"
            onClick={() => {
              updateCommunicationProfile(id, { canSpeak, canHear, canRead });
              setStep("questions");
              if (!canSpeak) void startGestureCamera();
            }}
          >
            {locale === "en" ? "Next" : "आगे"}
          </Button>
        </main>
      </AppFrame>
    );
  }

  // ── Step N: Questions ─────────────────────────────────────────────────────
  if (questionIdx >= activeQuestions.length) {
    // All done — effect above will call saveAndFinish
    return (
      <AppFrame>
        <AppHeader back={{ to: "/patient/$id", params: { id } }} title={t.intakeTitle} />
        <main className="flex flex-1 items-center justify-center px-4">
          <p className="text-2xl font-semibold text-pine">{t.intakeSaved} ✓</p>
        </main>
      </AppFrame>
    );
  }

  const q = activeQuestions[questionIdx]!;
  const qText = t[q.textKey] as string;
  const progress = Math.round(((questionIdx) / activeQuestions.length) * 100);

  return (
    <AppFrame>
      <AppHeader back={{ to: "/patient/$id", params: { id } }} title={t.intakeTitle} />
      <main className="flex flex-1 flex-col gap-5 px-4 pb-10 pt-4">
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
          <div
            className="h-full rounded-full bg-pine transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Mode label */}
        <p className="text-center text-[12px] font-medium uppercase tracking-wide text-muted">
          {!canSpeak ? t.intakeGestureMode : t.intakeTapMode}
        </p>

        {/* Question card — age band handled separately */}
        {q.kind === "ageband" ? (
          <AgeBandStep q={q} t={t} locale={locale} onAnswer={answerQuestion} />
        ) : (
          <YesNoStep
            q={q}
            t={t}
            locale={locale}
            videoRef={videoRef}
            gestureStatus={gestureStatus}
            showGestureHint={showGestureHint}
            confirmation={confirmation}
            canSpeak={canSpeak}
            onAnswer={answerQuestion}
            onBack={questionIdx > 0 ? () => setQuestionIdx((i) => i - 1) : undefined}
            onSkip={() => setQuestionIdx((i) => i + 1)}
          />
        )}
      </main>
    </AppFrame>
  );
}

// ── Yes/No question step ──────────────────────────────────────────────────────
function YesNoStep({
  q,
  t,
  locale,
  videoRef,
  gestureStatus,
  showGestureHint,
  confirmation,
  canSpeak,
  onAnswer,
  onBack,
  onSkip,
}: {
  q: YesNoQuestion;
  t: Strings;
  locale: Locale;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  gestureStatus: string;
  showGestureHint: boolean;
  confirmation: string | null;
  canSpeak: boolean;
  onAnswer: (v: boolean) => void;
  onBack?: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Icon + question text */}
      <div className="flex flex-col items-center gap-3 rounded-[24px] border border-line bg-paper px-6 py-8">
        <span className="text-[5rem] leading-none" aria-hidden>{q.icon}</span>
        <p className="text-center font-display text-[1.6rem] font-semibold leading-tight text-ink">
          {t[q.textKey] as string}
        </p>
        {locale !== "en" && (
          <p className="text-center text-sm text-muted">
            {/* English sub-label for gestures */}
            {q.textKey.toString().replace("intakeQ", "").replace(/([A-Z])/g, " $1").trim()}
          </p>
        )}
      </div>

      {/* Confirmation flash */}
      {confirmation !== null && (
        <div className="flex items-center justify-center rounded-[20px] bg-pine/10 border border-pine/30 py-6">
          <p className="font-display text-[2.5rem] font-bold text-pine">{confirmation}</p>
        </div>
      )}

      {/* Camera preview (gesture mode only) */}
      {!canSpeak && (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] border border-line bg-black/80">
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full scale-x-[-1] object-cover"
          />
          {gestureStatus !== "running" && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-[12px] text-paper leading-relaxed">
                {gestureStatus === "loading"
                  ? t.intakeGestureLoading
                  : gestureStatus === "unavailable"
                  ? t.intakeGestureUnavailable
                  : gestureStatus === "blocked"
                  ? t.intakeGestureCameraBlocked
                  : t.intakeGestureLoading}
              </p>
            </div>
          )}
          {/* Gesture hint overlay */}
          {gestureStatus === "running" && (
            <div className="absolute bottom-0 inset-x-0 flex items-end justify-center pb-2">
              <p className="text-center text-[10px] text-paper/80">
                👍 = {t.intakeYes} · 👎 = {t.intakeNo}
              </p>
            </div>
          )}
        </div>
      )}

      {/* No-gesture hint */}
      {showGestureHint && !canSpeak && (
        <p className="text-center text-[12px] text-amber-600 font-medium">
          {t.intakeGestureHint}
        </p>
      )}

      {/* NON-NEGOTIABLE: big tappable YES / NO buttons — always visible */}
      <div className="grid grid-cols-2 gap-3">
        <button
          id="btn-intake-yes"
          type="button"
          onClick={() => onAnswer(true)}
          className="flex flex-col items-center justify-center gap-1 rounded-[20px] border-2 border-pine bg-pine/10 py-7 text-pine font-bold text-[1.3rem] active:scale-95 transition-transform"
        >
          <span className="text-3xl">👍</span>
          <span>{t.intakeYes}</span>
          {locale !== "en" && <span className="text-xs font-normal text-pine/70">Yes</span>}
        </button>
        <button
          id="btn-intake-no"
          type="button"
          onClick={() => onAnswer(false)}
          className="flex flex-col items-center justify-center gap-1 rounded-[20px] border-2 border-red-400/60 bg-red-400/10 py-7 text-red-500 font-bold text-[1.3rem] active:scale-95 transition-transform"
        >
          <span className="text-3xl">👎</span>
          <span>{t.intakeNo}</span>
          {locale !== "en" && <span className="text-xs font-normal text-red-400/70">No</span>}
        </button>
      </div>

      {/* Back / Skip */}
      <div className="flex justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-muted underline">
            {t.intakeBack}
          </button>
        ) : <span />}
        <button type="button" onClick={onSkip} className="text-sm text-muted underline">
          {t.intakeSkip}
        </button>
      </div>
    </div>
  );
}

// ── Age-band selector ─────────────────────────────────────────────────────────
function AgeBandStep({
  t,
  locale,
  onAnswer,
}: {
  q: AgeBandQuestion;
  t: Strings;
  locale: Locale;
  onAnswer: (v: number) => void;
}) {
  const bands = [
    t.intakeAgeBand0,
    t.intakeAgeBand1,
    t.intakeAgeBand2,
    t.intakeAgeBand3,
    t.intakeAgeBand4,
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-3 rounded-[24px] border border-line bg-paper px-6 py-6">
        <span className="text-[4rem] leading-none" aria-hidden>👤</span>
        <p className="text-center font-display text-[1.6rem] font-semibold leading-tight text-ink">
          {t.intakeQAgeBand}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {bands.map((label, idx) => (
          <button
            key={idx}
            type="button"
            id={`btn-intake-age-${idx}`}
            onClick={() => onAnswer(idx)}
            className="w-full rounded-[16px] border border-line bg-paper px-5 py-4 text-left text-base font-semibold text-ink hover:border-pine/40 hover:bg-pine/5 active:scale-98 transition-all"
          >
            {label}
            {locale !== "en" && (
              <span className="ml-2 text-xs font-normal text-muted">
                ({["< 12", "12–17", "18–59", "60–74", "75+"][idx]})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
