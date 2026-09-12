import { useState } from "react";
import type { Patient } from "@/lib/univolt/types";
import { communicationProfile, useUnivolt } from "@/lib/univolt/store";
import { getStrings, type Locale, type Strings } from "@/lib/translations";
import { SpeakerButton } from "./speaker-button";
import { PhraseBoard } from "./phrase-board";
import { LiveCaptioning } from "./live-captioning";

type Mode = "read" | "phrase" | "caption";

/**
 * "Communication Assistance" — the accessibility-layer entry point on the
 * patient page. Shows the communication profile toggles (canSpeak / canHear
 * / canRead, default true, stored on the patient record) and all three
 * modes. All three modes stay reachable regardless of the toggle state —
 * the toggles only drive the note shown on speech-dependent test screens.
 */
export function CommunicationAssistanceSection({
  patient,
  locale,
  onSetLocale,
}: {
  patient: Patient;
  locale: Locale;
  onSetLocale: (locale: Locale) => void;
}) {
  const t: Strings = getStrings(locale);
  const updateCommunicationProfile = useUnivolt((s) => s.updateCommunicationProfile);
  const profile = communicationProfile(patient);
  const [mode, setMode] = useState<Mode>("read");

  return (
    <section className="rounded-[24px] border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t.commSectionTitle}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{t.commSectionSubtitle}</p>
        </div>
        {/* Language toggle — shared with the rest of the app's translations mechanism */}
        <div className="flex shrink-0 gap-1 rounded-[10px] bg-surface p-0.5">
          <button
            type="button"
            onClick={() => onSetLocale("en")}
            className={`rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
              locale === "en" ? "bg-pine text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {t.localeNameEn}
          </button>
          <button
            type="button"
            onClick={() => onSetLocale("hi")}
            className={`rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
              locale === "hi" ? "bg-pine text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {t.localeNameHi}
          </button>
        </div>
      </div>

      {/* Communication profile toggles */}
      <div className="mt-3 grid gap-2 border-t border-line pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{t.commProfileTitle}</p>
        <ToggleRow
          label={t.commCanSpeakLabel}
          checked={profile.canSpeak}
          onChange={(v) => updateCommunicationProfile(patient.id, { canSpeak: v })}
        />
        <ToggleRow
          label={t.commCanHearLabel}
          checked={profile.canHear}
          onChange={(v) => updateCommunicationProfile(patient.id, { canHear: v })}
        />
        <ToggleRow
          label={t.commCanReadLabel}
          checked={profile.canRead}
          onChange={(v) => updateCommunicationProfile(patient.id, { canRead: v })}
        />
      </div>

      {/* Mode tabs — every mode stays reachable no matter what the toggles above say */}
      <div className="mt-4 flex gap-1.5 rounded-[12px] bg-surface p-1">
        <ModeTab active={mode === "read"} onClick={() => setMode("read")} label={t.commModeReadAloud} />
        <ModeTab active={mode === "phrase"} onClick={() => setMode("phrase")} label={t.commModePhraseBoard} />
        <ModeTab active={mode === "caption"} onClick={() => setMode("caption")} label={t.commModeCaptioning} />
      </div>

      <div className="mt-4">
        {mode === "read" ? (
          <div>
            <p className="text-[12px] leading-relaxed text-muted">{t.commModeReadAloudDesc}</p>
            <div className="mt-3 flex items-start justify-between gap-3 rounded-[16px] border border-line bg-surface p-3">
              <p className="text-sm leading-relaxed text-ink">{t.commReadAloudDemoText}</p>
              <SpeakerButton text={t.commReadAloudDemoText} locale={locale} t={t} />
            </div>
          </div>
        ) : null}

        {mode === "phrase" ? (
          <div>
            <p className="text-[12px] leading-relaxed text-muted">{t.commModePhraseBoardDesc}</p>
            <div className="mt-3">
              <PhraseBoard locale={locale} t={t} />
            </div>
          </div>
        ) : null}

        {mode === "caption" ? (
          <div>
            <p className="text-[12px] leading-relaxed text-muted">{t.commModeCaptioningDesc}</p>
            <div className="mt-3">
              <LiveCaptioning locale={locale} t={t} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-[12px] bg-surface px-3 py-2.5 text-left"
    >
      <span className="text-sm text-ink">{label}</span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-pine" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-paper shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ModeTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[10px] px-2 py-2 text-[12px] font-medium transition-colors ${
        active ? "bg-pine text-paper" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
