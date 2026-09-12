import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { Locale, Strings } from "@/lib/translations";

/**
 * Voice picker for read-aloud (Mode A). Enumerates `speechSynthesis.getVoices()`
 * (refreshed on the `voiceschanged` event inside the hook), filtered to the
 * voices worth offering for the current locale — Hindi first, then en-IN.
 * When the device has no Hindi voice we say so plainly and stay on English.
 */
export function VoicePicker({ locale, t }: { locale: Locale; t: Strings }) {
  const { voices, voice, selectedVoiceUri, setSelectedVoiceUri, supported, hindiAvailable } =
    useSpeechSynthesis(locale);

  if (!supported) {
    return <p className="text-[11px] text-faint">{t.commSpeechUnsupported}</p>;
  }

  return (
    <div>
      <label
        htmlFor="comm-voice-picker"
        className="text-[11px] font-medium uppercase tracking-wide text-muted"
      >
        {t.commVoicePickerLabel}
      </label>
      <select
        id="comm-voice-picker"
        value={selectedVoiceUri ?? ""}
        onChange={(e) => setSelectedVoiceUri(e.target.value === "" ? null : e.target.value)}
        className="mt-1 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] text-ink"
      >
        <option value="">
          {t.commVoiceAutomatic}
          {voice ? ` — ${voice.name} (${voice.lang})` : ""}
        </option>
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
      {voices.length === 0 ? (
        <p className="mt-1 text-[11px] text-faint">{t.commVoiceNoneInstalled}</p>
      ) : null}
      {!hindiAvailable ? (
        <p className="mt-1 text-[11px] text-faint">{t.commVoiceHindiUnavailable}</p>
      ) : null}
    </div>
  );
}
