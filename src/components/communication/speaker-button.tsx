import { Square, Volume2 } from "lucide-react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { Locale, Strings } from "@/lib/translations";
import { cn } from "@/lib/utils";

/**
 * Speaker button for guidance/instruction cards — Mode A (Read aloud).
 * Speaks `text` via speechSynthesis only when tapped (never automatically).
 * Fully offline. Shows a "Hindi voice not available" note and silently
 * falls back to English when the device has no Hindi voice installed.
 */
export function SpeakerButton({
  text,
  locale,
  t,
  className,
  compact = false,
}: {
  text: string;
  locale: Locale;
  t: Strings;
  className?: string;
  /** Icon-only, no fallback note — for tight spaces like list rows. */
  compact?: boolean;
}) {
  const { speaking, supported, hindiAvailable, speak, stop } = useSpeechSynthesis(locale);

  if (!supported) return null;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        aria-label={speaking ? t.commStopButton : t.commSpeakButton}
        aria-pressed={speaking}
        onClick={() => (speaking ? stop() : speak(text))}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink transition-colors hover:bg-paper active:scale-[0.96]",
          speaking && "border-pine bg-pine/10 text-pine",
        )}
      >
        {speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      {!compact && locale === "hi" && !hindiAvailable ? (
        <span className="text-[10px] leading-tight text-faint">{t.commVoiceHindiUnavailable}</span>
      ) : null}
    </div>
  );
}
