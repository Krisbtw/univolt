import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnivolt } from "@/lib/univolt/store";
import type { Sex, Patient } from "@/lib/univolt/types";
import { getStrings } from "@/lib/translations";
import { loadLocale } from "@/lib/vitalsDatabase";

export const Route = createFileRoute("/register")({ component: RegisterScreen });

function RegisterScreen() {
  const addPatient = useUnivolt((s) => s.addPatient);
  const updateCommunicationProfile = useUnivolt((s) => s.updateCommunicationProfile);
  const navigate = useNavigate();

  const [step, setStep] = useState<"details" | "comm">("details");
  const [createdPatient, setCreatedPatient] = useState<Patient | null>(null);

  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  const [age, setAge] = useState("42");
  const [sex, setSex] = useState<Sex>("F");

  // Step 2 communication state
  const [canSpeak, setCanSpeak] = useState(true);
  const [canHear, setCanHear] = useState(true);
  const [canRead, setCanRead] = useState(true);

  const locale = loadLocale() ?? "en";
  const t = useMemo(() => getStrings(locale), [locale]);

  function onSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    const parsedAge = Number(age);
    if (!name.trim() || !village.trim() || !Number.isFinite(parsedAge) || parsedAge < 0) return;
    const patient = addPatient({
      name: name.trim(),
      village: village.trim(),
      age: Math.round(parsedAge),
      sex,
    });
    setCreatedPatient(patient);
    setStep("comm");
  }

  function onFinishComm(skipIntake?: boolean) {
    if (!createdPatient) return;
    updateCommunicationProfile(createdPatient.id, { canSpeak, canHear, canRead });
    if (!skipIntake && !canSpeak) {
      void navigate({ to: "/patient/$id/intake", params: { id: createdPatient.id } });
    } else {
      void navigate({ to: "/patient/$id", params: { id: createdPatient.id } });
    }
  }

  if (step === "comm" && createdPatient) {
    return (
      <AppFrame>
        <AppHeader
          back={{ to: "/patient/$id", params: { id: createdPatient.id } }}
          title={t.intakeCommStep}
          subtitle={`Case: ${createdPatient.caseId} · ${createdPatient.name}`}
        />
        <main className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-4">
          <div>
            <h2 className="font-display text-[1.3rem] font-semibold text-ink">
              {t.intakeCommStep}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.intakeCommHint}</p>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { id: "toggle-can-speak", label: t.intakeCanSpeak, value: canSpeak, set: setCanSpeak },
              { id: "toggle-can-hear", label: t.intakeCanHear, value: canHear, set: setCanHear },
              { id: "toggle-can-read", label: t.intakeCanRead, value: canRead, set: setCanRead },
            ].map(({ id, label, value, set }) => (
              <button
                key={id}
                id={id}
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

          {!canSpeak && (
            <div className="rounded-[14px] border border-pine/30 bg-pine/10 px-4 py-2.5">
              <p className="text-[12px] text-pine font-medium">
                {locale === "en"
                  ? "Non-speaking mode enabled: intake questions will use gestures (👍/👎) with camera and tap fallbacks."
                  : "अवाक मोड सक्रिय: जानकारी के प्रश्न कैमरे द्वारा इशारों (👍/👎) और टैप विकल्प से पूछे जाएँगे।"}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-2">
            <Button
              id="btn-comm-continue"
              size="lg"
              onClick={() => onFinishComm(false)}
            >
              {!canSpeak
                ? (locale === "en" ? "Start gesture intake →" : "इशारा जानकारी शुरू करें →")
                : (locale === "en" ? "Continue to patient profile" : "मरीज़ प्रोफ़ाइल पर जाएँ")}
            </Button>
            <Button
              id="btn-comm-skip"
              variant="outline"
              size="sm"
              onClick={() => onFinishComm(true)}
            >
              {t.intakeSkip}
            </Button>
          </div>
        </main>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <AppHeader back={{ to: "/" }} title="Register patient" subtitle="Stored only on this device." />
      <form onSubmit={onSubmitDetails} className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Full name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Kavita Joshi" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Village</span>
          <Input value={village} onChange={(e) => setVillage(e.target.value)} required placeholder="e.g. Sikar" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Age</span>
            <Input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </label>
          <fieldset className="block">
            <legend className="mb-1.5 text-sm font-medium text-ink">Sex</legend>
            <div className="flex h-11 overflow-hidden rounded-[12px] border border-line bg-paper">
              {(["F", "M", "X"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSex(opt)}
                  className={`flex-1 text-sm font-medium ${
                    sex === opt ? "bg-pine text-pine-fg" : "text-muted hover:bg-surface"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <Button id="btn-save-roster" type="submit" size="lg" className="mt-2">
          Save to roster
        </Button>
      </form>
    </AppFrame>
  );
}

