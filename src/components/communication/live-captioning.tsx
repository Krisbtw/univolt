import { Mic, Trash2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale, Strings } from "@/lib/translations";

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/**
 * Live captioning — Mode C, for patients who cannot hear. Press-and-hold
 * mic button using the Web Speech API. HONEST BY DESIGN: this API sends
 * audio to a server for recognition and needs internet — it is NOT part
 * of the offline core, so we show a permanent "requires internet" badge
 * and disable the control (with a clear reason) whenever the device is
 * offline, rather than silently failing.
 */
export function LiveCaptioning({ locale, t }: { locale: Locale; t: Strings }) {
  const RecognitionCtor = getRecognitionCtor();
  const supported = RecognitionCtor !== null;

  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => {
      setOnline(false);
      recognitionRef.current?.stop();
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Stop recognition on unmount so the mic never stays hot in the background.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimText("");
  }, []);

  const startListening = useCallback(() => {
    if (!supported || !RecognitionCtor || !online || listening) return;
    const recognition = new RecognitionCtor();
    recognition.lang = locale === "hi" ? "hi-IN" : "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += chunk;
        else interimChunk += chunk;
      }
      if (finalChunk) setFinalText((prev) => (prev ? `${prev} ${finalChunk}` : finalChunk).trim());
      setInterimText(interimChunk);
    };
    recognition.onerror = () => {
      setListening(false);
      setInterimText("");
    };
    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [supported, RecognitionCtor, online, listening, locale]);

  const handleClear = useCallback(() => {
    setFinalText("");
    setInterimText("");
  }, []);

  if (!supported) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.commCaptionTitle}</h3>
        <p className="mt-2 text-sm text-muted">{t.commCaptionUnsupported}</p>
      </div>
    );
  }

  const disabled = !online;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t.commCaptionTitle}</h3>
        {/* Permanent badge — this feature is never claimed as offline. */}
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/12 px-2.5 py-0.5 text-[10px] font-medium text-amber-500">
          <WifiOff className="size-3" />
          {t.commCaptionInternetBadge}
        </span>
      </div>

      {!online ? (
        <p className="mb-3 rounded-[12px] bg-amber-400/10 px-3 py-2 text-[12px] leading-relaxed text-amber-600">
          {t.commCaptionOfflineMessage}
        </p>
      ) : null}

      <div className="min-h-[6rem] rounded-[16px] bg-surface px-4 py-3" aria-live="polite">
        {finalText || interimText ? (
          <p className="font-display text-[1.35rem] leading-snug text-ink">
            {finalText}
            {interimText ? <span className="text-faint"> {interimText}</span> : null}
          </p>
        ) : (
          <p className="text-sm text-faint">{t.commCaptionEmptyState}</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => {
            e.preventDefault();
            startListening();
          }}
          onPointerUp={stopListening}
          onPointerLeave={() => listening && stopListening()}
          onPointerCancel={stopListening}
          className={`flex-1 select-none rounded-[12px] px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            listening ? "bg-pine text-paper" : "border border-line bg-paper text-ink hover:bg-surface"
          }`}
        >
          <Mic className="mr-2 inline size-4" />
          {listening ? t.commCaptionListening : t.commCaptionHoldToTalk}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-[12px] border border-line px-4 py-3 text-sm font-medium text-ink hover:bg-paper"
        >
          <Trash2 className="mr-1.5 inline size-4" />
          {t.commCaptionClear}
        </button>
      </div>
    </div>
  );
}
