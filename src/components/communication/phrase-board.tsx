import { useState } from "react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { Locale, Strings } from "@/lib/translations";

const PAIN_LEVELS = Array.from({ length: 11 }, (_, n) => n);

/**
 * "Tap to speak" phrase board — Mode B, for patients who cannot speak.
 * Tapping a phrase or a pain-scale number speaks it aloud (offline TTS)
 * AND shows it in large type for the clinician to read. Nothing here
 * leaves the device — no network calls.
 */
export function PhraseBoard({ locale, t }: { locale: Locale; t: Strings }) {
  const { speak, speaking, supported, hindiAvailable } = useSpeechSynthesis(locale);
  const [lastSpoken, setLastSpoken] = useState<string | null>(null);

  function say(text: string) {
    setLastSpoken(text);
    speak(text);
  }

  return (
    <div>
      {/* Large-type readout for the clinician */}
      <div
        className="mb-3 min-h-[4.25rem] rounded-[16px] border border-pine/25 bg-pine/6 px-4 py-3"
        aria-live="polite"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-pine">
          {t.commPhraseBoardSpokenLabel}
        </p>
        <p className="mt-1 font-display text-[1.5rem] font-semibold leading-tight text-ink">
          {lastSpoken ?? "—"}
        </p>
      </div>

      {/* Phrase grid */}
      <div className="grid grid-cols-4 gap-2">
        {t.commPhrases.map((phrase) => (
          <button
            key={phrase.id}
            type="button"
            onClick={() => say(phrase.text)}
            className={`flex flex-col items-center gap-1 rounded-[14px] border px-1.5 py-3 text-center transition-colors active:scale-[0.97] ${
              speaking && lastSpoken === phrase.text
                ? "border-pine bg-pine/10"
                : "border-line bg-surface hover:bg-paper"
            }`}
          >
            <span className="text-[1.4rem] leading-none">{phrase.icon}</span>
            <span className="text-[10.5px] font-medium leading-tight text-ink">{phrase.text}</span>
          </button>
        ))}
      </div>

      {/* 0–10 pain scale */}
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
          {t.commPainLabel}
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {PAIN_LEVELS.map((n) => {
            const sentence = t.commPainSentence.replace("{level}", String(n));
            return (
              <button
                key={n}
                type="button"
                onClick={() => say(sentence)}
                className={`flex h-10 items-center justify-center rounded-[10px] border text-sm font-semibold tabular-nums transition-colors active:scale-[0.97] ${
                  speaking && lastSpoken === sentence
                    ? "border-pine bg-pine/10 text-pine"
                    : "border-line bg-surface text-ink hover:bg-paper"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {!supported ? (
        <p className="mt-3 text-[11px] text-faint">{t.commSpeechUnsupported}</p>
      ) : locale === "hi" && !hindiAvailable ? (
        <p className="mt-3 text-[11px] text-faint">{t.commVoiceHindiUnavailable}</p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-faint">{t.commPhraseBoardNote}</p>
    </div>
  );
}
