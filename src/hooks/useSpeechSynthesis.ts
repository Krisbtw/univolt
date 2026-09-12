import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/translations";

export type SpeechSynthesisState = {
  /** True while an utterance triggered by this hook is playing. */
  speaking: boolean;
  /** True if `window.speechSynthesis` exists at all in this browser. */
  supported: boolean;
  /** True if at least one Hindi ("hi*") voice is installed on this device. */
  hindiAvailable: boolean;
  /** Voices relevant to the current locale (hi first, then en-IN, then any en). */
  voices: SpeechSynthesisVoice[];
  /** The voice that will actually be used (manual pick, else best automatic match). */
  voice: SpeechSynthesisVoice | null;
  /** voiceURI of the manually picked voice, or null while on automatic. */
  selectedVoiceUri: string | null;
  /** Pick a voice by voiceURI; pass null to go back to automatic selection. */
  setSelectedVoiceUri: (voiceUri: string | null) => void;
  /** Speak `text` using the best available voice for `locale`. Cancels any speech in progress. Fully offline — never calls a network API. */
  speak: (text: string) => void;
  /** Stop any speech in progress. */
  stop: () => void;
};

// ── Shared voice preference ──────────────────────────────────────────────────
// The picker lives in one place but every speaker button must honour it, so the
// preference is module-level (with subscribers) instead of per-component state.

const STORAGE_KEY = "univolt.tts.voiceUri";
let preferredVoiceUri: string | null = null;
const listeners = new Set<(value: string | null) => void>();

function readStoredVoiceUri(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setPreferredVoiceUri(value: string | null) {
  preferredVoiceUri = value;
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // storage unavailable (private mode) — keep the in-memory preference only
  }
  for (const listener of listeners) listener(value);
}

/** Voices worth offering for `locale`: Hindi first, then en-IN, then other English. */
export function relevantVoices(
  voices: SpeechSynthesisVoice[],
  locale: Locale,
): SpeechSynthesisVoice[] {
  const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase();
  const hindi = voices.filter((v) => lang(v).startsWith("hi"));
  const enIN = voices.filter((v) => lang(v).startsWith("en-in"));
  const enOther = voices.filter((v) => lang(v).startsWith("en") && !lang(v).startsWith("en-in"));
  return locale === "hi" ? [...hindi, ...enIN, ...enOther] : [...enIN, ...enOther, ...hindi];
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: Locale,
  manualUri: string | null,
): { voice: SpeechSynthesisVoice | null; hindiAvailable: boolean } {
  const hindi = voices.filter((v) => v.lang.toLowerCase().startsWith("hi"));
  const enIN = voices.filter((v) => v.lang.toLowerCase().startsWith("en-in"));
  const enAny = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const hindiAvailable = hindi.length > 0;

  if (manualUri) {
    const manual = voices.find((v) => v.voiceURI === manualUri);
    if (manual) return { voice: manual, hindiAvailable };
  }

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
  const [manualUri, setManualUri] = useState<string | null>(preferredVoiceUri);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Hydrate the stored preference on the client and stay in sync with other
  // components that change it.
  useEffect(() => {
    if (preferredVoiceUri === null) {
      const stored = readStoredVoiceUri();
      if (stored) {
        preferredVoiceUri = stored;
        setManualUri(stored);
      }
    }
    const listener = (value: string | null) => setManualUri(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!supported) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, [supported]);

  const { voice, hindiAvailable } = pickVoice(voices, locale, manualUri);

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

  return {
    speaking,
    supported,
    hindiAvailable,
    voices: relevantVoices(voices, locale),
    voice,
    selectedVoiceUri: manualUri,
    setSelectedVoiceUri: setPreferredVoiceUri,
    speak,
    stop,
  };
}
