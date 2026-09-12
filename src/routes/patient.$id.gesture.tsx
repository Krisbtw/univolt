import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { GestureCommunication } from "@/components/communication/gesture-communication";
import { getStrings, type Locale, type Strings } from "@/lib/translations";
import { loadLocale, saveLocale } from "@/lib/vitalsDatabase";

export const Route = createFileRoute("/patient/$id/gesture")({ component: GestureScreen });

function GestureScreen() {
  const { id } = Route.useParams();
  const [locale, setLocale] = useState<Locale>(() => loadLocale() ?? "en");
  const t: Strings = getStrings(locale);

  useEffect(() => {
    saveLocale(locale);
  }, [locale]);

  return (
    <AppFrame>
      <AppHeader back={{ to: "/patient/$id", params: { id } }} />
      <main className="flex flex-col gap-4 px-4 pb-10 pt-4">
        <div className="flex gap-1 self-end rounded-[10px] bg-surface p-0.5">
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={`rounded-[8px] px-2.5 py-1 text-[11px] font-medium ${
              locale === "en" ? "bg-pine text-paper" : "text-muted"
            }`}
          >
            {t.localeNameEn}
          </button>
          <button
            type="button"
            onClick={() => setLocale("hi")}
            className={`rounded-[8px] px-2.5 py-1 text-[11px] font-medium ${
              locale === "hi" ? "bg-pine text-paper" : "text-muted"
            }`}
          >
            {t.localeNameHi}
          </button>
        </div>
        <GestureCommunication locale={locale} t={t} />
      </main>
    </AppFrame>
  );
}
