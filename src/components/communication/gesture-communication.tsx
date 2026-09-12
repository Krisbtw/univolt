import { useCallback, useEffect, useRef, useState } from "react";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { Locale, Strings } from "@/lib/translations";
import {
  GESTURE_HOLD_FRAMES,
  GESTURE_VOCABULARY,
  loadGestureRecognizer,
  recognizeGesture,
  type SupportedGesture,
} from "@/lib/gestureRecognizer";

type Status = "idle" | "loading" | "running" | "unavailable" | "blocked";

const FRAME_INTERVAL_MS = 1000 / 30; // throttle detection to ~30 fps

const GESTURE_ICON: Record<SupportedGesture, string> = {
  Thumb_Up: "👍",
  Thumb_Down: "👎",
  Victory: "✌️",
  Open_Palm: "🖐️",
};

function phraseFor(gesture: SupportedGesture, t: Strings): string {
  switch (gesture) {
    case "Thumb_Up":
      return t.gestureYes;
    case "Thumb_Down":
      return t.gestureNo;
    case "Victory":
      return t.gestureWater;
    case "Open_Palm":
      return t.gestureHelp;
  }
}

/**
 * Gesture communication — PROTOTYPE. Uses MediaPipe's canned GestureRecognizer
 * vocabulary (four gestures mapped to fixed phrases). Deliberately labelled as
 * a prototype: this is not sign-language recognition.
 */
export function GestureCommunication({ locale, t }: { locale: Locale; t: Strings }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const streakRef = useRef<{ key: string | null; frames: number }>({ key: null, frames: 0 });
  const acceptedRef = useRef<string | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const { speak } = useSpeechSynthesis(locale);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    streakRef.current = { key: null, frames: 0 };
    acceptedRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const accept = useCallback(
    (text: string) => {
      setPhrase(text);
      setHistory((prev) => [text, ...prev].slice(0, 6));
      speak(text);
    },
    [speak],
  );

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    const recognizer = recognizerRef.current;
    if (!video || !recognizer || video.readyState < 2) return;

    const now = performance.now();
    if (now - lastFrameAtRef.current < FRAME_INTERVAL_MS) return;
    lastFrameAtRef.current = now;

    const frame = recognizeGesture(recognizer, video, now);
    if (!frame) return;

    // Optional pain scale: 1–5 extended fingers, only when no canned gesture matched.
    const key =
      frame.gesture ??
      (frame.fingerCount != null && frame.fingerCount >= 1 && frame.fingerCount <= 5
        ? `pain:${frame.fingerCount}`
        : null);

    if (key === null) {
      streakRef.current = { key: null, frames: 0 };
      return;
    }

    if (streakRef.current.key === key) {
      streakRef.current.frames += 1;
    } else {
      streakRef.current = { key, frames: 1 };
    }

    // Debounce: only accept after ~15 consecutive matching frames (~0.5 s).
    if (streakRef.current.frames === GESTURE_HOLD_FRAMES && acceptedRef.current !== key) {
      acceptedRef.current = key;
      if (key.startsWith("pain:")) {
        const level = key.slice(5);
        accept(t.gesturePainSentence.replace("{level}", level));
      } else {
        accept(phraseFor(key as SupportedGesture, t));
      }
    } else if (streakRef.current.frames < GESTURE_HOLD_FRAMES) {
      acceptedRef.current = acceptedRef.current === key ? acceptedRef.current : null;
    }
  }, [accept, t]);

  const start = useCallback(async () => {
    setStatus("loading");
    const recognizer = await loadGestureRecognizer();
    if (!recognizer) {
      setStatus("unavailable");
      return;
    }
    recognizerRef.current = recognizer;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setStatus("running");
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setStatus("blocked");
    }
  }, [loop]);

  return (
    <div>
      {/* Honesty block — prototype label, fixed vocabulary size, roadmap note */}
      <h2 className="font-display text-[1.35rem] font-semibold leading-tight text-ink">
        {t.gestureTitle}
      </h2>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        {t.gestureVocabCount}
      </p>
      <p className="mt-2 rounded-[12px] border border-amber-400/30 bg-amber-400/8 px-3 py-2 text-[12px] leading-relaxed text-amber-600">
        {t.gestureRoadmapNote}
      </p>

      {/* Mirrored front-camera preview */}
      <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-[18px] border border-line bg-black/80">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full scale-x-[-1] object-cover"
        />
        {status !== "running" ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-[12px] leading-relaxed text-paper">
              {status === "loading"
                ? t.gestureLoading
                : status === "unavailable"
                  ? t.gestureUnavailable
                  : status === "blocked"
                    ? t.gestureCameraBlocked
                    : t.gestureStart}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => (status === "running" ? stop() : void start())}
          disabled={status === "loading"}
          className="flex-1 rounded-[12px] bg-pine px-4 py-3 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {status === "running" ? t.gestureStop : t.gestureStart}
        </button>
      </div>

      {/* Recognized phrase, large type */}
      <div
        className="mt-3 min-h-[4.5rem] rounded-[16px] border border-pine/25 bg-pine/6 px-4 py-3"
        aria-live="polite"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-pine">
          {t.gestureRecognizedLabel}
        </p>
        <p className="mt-1 font-display text-[1.6rem] font-semibold leading-tight text-ink">
          {phrase ?? "—"}
        </p>
        {phrase === null ? (
          <p className="mt-1 text-[11px] text-faint">{t.gestureWaiting}</p>
        ) : null}
      </div>

      {/* History strip */}
      {history.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t.gestureHistoryLabel}
          </p>
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
            {history.map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-ink"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Legend */}
      <div className="mt-4 rounded-[16px] border border-line bg-surface p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {t.gestureLegendTitle}
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {GESTURE_VOCABULARY.map((gesture) => (
            <li key={gesture} className="flex items-center gap-2 rounded-[12px] bg-paper px-2.5 py-2">
              <span className="text-[1.35rem] leading-none">{GESTURE_ICON[gesture]}</span>
              <span className="text-[12px] font-medium text-ink">{phraseFor(gesture, t)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">{t.gesturePainLabel}</p>
      </div>
    </div>
  );
}
