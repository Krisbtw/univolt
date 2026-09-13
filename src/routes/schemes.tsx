import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { SCHEMES } from "@/lib/schemes";
import { getStrings, type Locale, type Strings } from "@/lib/translations";
import { loadLocale, saveLocale } from "@/lib/vitalsDatabase";
import { useEffect } from "react";

export const Route = createFileRoute("/schemes")({ component: SchemesScreen });

function SchemesScreen() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale() ?? "en");
  const t: Strings = useMemo(() => getStrings(locale), [locale]);

  useEffect(() => {
    saveLocale(locale);
  }, [locale]);

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/" }}
        title={t.schemesTitle}
        subtitle={t.schemesSubtitle}
      />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-10 pt-4">
        {/* Locale switcher */}
        <div className="flex gap-1 self-end rounded-[10px] bg-surface p-0.5">
          {(["en", "hi"] as Locale[]).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              className={`rounded-[8px] px-2.5 py-1 text-[11px] font-medium ${
                locale === loc ? "bg-pine text-paper" : "text-muted"
              }`}
            >
              {loc === "en" ? t.localeNameEn : t.localeNameHi}
            </button>
          ))}
        </div>

        {/* Informational disclaimer banner */}
        <div className="rounded-[14px] border border-amber-400/30 bg-amber-400/8 px-4 py-3">
          <p className="text-[12px] leading-relaxed text-amber-600">
            {locale === "en"
              ? "These schemes are described as they appear in official government publications. We do not compute or claim eligibility for any individual patient — always verify on the official portal."
              : "ये योजनाएँ सरकारी प्रकाशनों में जैसी वर्णित हैं वैसी ही प्रस्तुत हैं। हम किसी भी व्यक्तिगत मरीज़ के लिए पात्रता की गणना या दावा नहीं करते — हमेशा आधिकारिक पोर्टल पर सत्यापित करें।"}
          </p>
        </div>

        {/* Scheme cards */}
        <ul className="flex flex-col gap-4">
          {SCHEMES.map((scheme) => (
            <SchemeCard key={scheme.id} scheme={scheme} locale={locale} t={t} />
          ))}
        </ul>
      </main>
    </AppFrame>
  );
}

function SchemeCard({
  scheme,
  locale,
  t,
}: {
  scheme: (typeof SCHEMES)[0];
  locale: Locale;
  t: Strings;
}) {
  const isHi = locale === "hi";
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-[20px] border border-line bg-paper overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full px-4 pt-4 pb-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-[1.05rem] font-semibold leading-snug text-ink">
            {isHi ? scheme.nameHi : scheme.nameEn}
          </h2>
          <span className="mt-0.5 shrink-0 text-sm text-muted">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted line-clamp-2">
          {isHi ? scheme.coverageHi : scheme.coverageEn}
        </p>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-line px-4 pb-4 pt-3 flex flex-col gap-3">
          <SchemeRow
            label={t.schemesWhatCovers}
            value={isHi ? scheme.coverageHi : scheme.coverageEn}
          />
          <SchemeRow
            label={t.schemesWhoFor}
            value={isHi ? scheme.whoForHi : scheme.whoForEn}
          />
          <SchemeRow
            label={t.schemesEnrollHow}
            value={isHi ? scheme.enrollHi : scheme.enrollEn}
          />
          <SchemeRow
            label={t.schemesDocuments}
            value={isHi ? scheme.documentsHi : scheme.documentsEn}
          />

          {/* Portal link */}
          <div className="mt-1 flex items-center gap-2">
            <a
              href={scheme.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-pine px-3 py-2 text-[13px] font-semibold text-paper no-underline"
            >
              🔗 {t.schemesOfficialPortal}
            </a>
          </div>

          {/* Honesty footer — required on every card */}
          <p className="text-[11px] leading-relaxed text-faint border-t border-line pt-2 mt-1">
            ⚠️ {t.schemesVerifyFooter}
          </p>
        </div>
      )}
    </li>
  );
}

function SchemeRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-ink">{value}</p>
    </div>
  );
}
