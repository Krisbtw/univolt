import { communicationProfile } from "@/lib/univolt/store";
import type { Patient } from "@/lib/univolt/types";
import type { Strings } from "@/lib/translations";

/**
 * Note shown on speech-dependent test screens (cough, breath) when the patient
 * is marked as non-speaking. This is a NOTE ONLY — it never blocks or disables
 * any test; the clinician stays in control.
 */
export function NonSpeakingNote({ patient, t }: { patient: Patient | null; t: Strings }) {
  if (!patient) return null;
  if (communicationProfile(patient).canSpeak) return null;

  return (
    <p
      role="note"
      className="rounded-[12px] border border-amber-400/30 bg-amber-400/8 px-3 py-2 text-[12px] leading-relaxed text-amber-600"
    >
      {t.commNonSpeakingNote}
    </p>
  );
}
