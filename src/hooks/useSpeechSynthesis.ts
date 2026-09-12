import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/translations";

export type SpeechSynthesisState = {
  /** True while an utterance triggered by this hook is playing. */
  speaking: boolean;
  /** True if `window.speechSynthesis` exists at all in this browser. */
  supported: boolean;
  /** True if at least one Hindi ("hi*") voice is installed on this device. */
  hindiAvailable: boolean;
  /** Speak `text` using the best available voice for `locale`. Cancels any speech in progress. Fully offline — never calls a network API. */
  speak: (text: string) => void;
  /** Stop any speech in progress. */
  stop: () => void;
};

function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: Locale,
): { voice: SpeechSynthesisVoice | null; hindiAvailable: boolean } {
  const hindi = voices.filter((v) => v.lang.toLowerCase().startsWith("hi"));
  const enIN = voices.filter((v) => v.lang.toLowerCase().startsWith("en-in"));
  const enAny = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const hindiAvailable = hindi.length > 0;

  if (locale === "hi" && hindiAvailable) {
    return { voice: hindi[0] ?? null, hindiAvailable: true };
  }
  // en-IN preferred fallback, then any English voice, then whatever the
  // device offers, then null (browser will use its own default voice).
  const fallback = enIN[0] ?? enAny[0] ?? voices[0] ?? null;
  return { voice: fallback, hindiAvailable };
}

/**
 * Offline read-aloud (Mode A / Communication Assistance). Wraps the browser's
 * `speechSynthesis` API — nothing here ever leaves the device. Never speaks
 * automatically; `speak()` only fires when the caller (a tap handler) invokes it.
 */
export function useSpeechSynthesis(locale: Locale): SpeechSynthesisState {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    supported ? window.speechSynthesis.getVoices() : [],
  );
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!supported) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, [supported]);

  const { voice, hindiAvailable } = pickVoice(voices, locale);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      // Only one utterance at a time — cancel whatever was playing.
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? (locale === "hi" ? "hi-IN" : "en-IN");
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      utteranceRef.current = utterance;
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported, voice, locale],
  );

  // Stop any in-flight speech when the component unmounts.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { speaking, supported, hindiAvailable, speak, stop };
}
