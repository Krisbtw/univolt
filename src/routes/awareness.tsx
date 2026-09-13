import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { DISTRICTS, REGIONAL_ADVISORIES, type RegionalAdvisory } from "@/lib/advisories";
import { HEALTH_AWARENESS_CARDS, type HealthLiteracyCard } from "@/lib/awareness";
import { getStrings, type Locale, type Strings } from "@/lib/translations";
import { loadLocale, saveLocale } from "@/lib/vitalsDatabase";
import { SpeakerButton } from "@/components/communication/speaker-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, MapPin, Sparkles, BookOpen, Search, Info } from "lucide-react";

export type AwarenessSearch = {
  topic?: string;
  district?: string;
};

export const Route = createFileRoute("/awareness")({
  validateSearch: (search: Record<string, unknown>): AwarenessSearch => {
    return {
      topic: typeof search.topic === "string" ? search.topic : undefined,
      district: typeof search.district === "string" ? search.district : undefined,
    };
  },
  component: AwarenessScreen,
});

function AwarenessScreen() {
  const searchParams = Route.useSearch();
  const [locale, setLocale] = useState<Locale>(() => loadLocale() ?? "en");
  const t: Strings = useMemo(() => getStrings(locale), [locale]);
  const isHi = locale === "hi";

  useEffect(() => {
    saveLocale(locale);
  }, [locale]);

  // Active section tab: "cards" | "advisories"
  const [activeTab, setActiveTab] = useState<"cards" | "advisories">("cards");

  // Selected district for regional advisories
  const [selectedDistrict, setSelectedDistrict] = useState<string>(() => {
    if (searchParams.district && DISTRICTS.some((d) => d.id === searchParams.district)) {
      return searchParams.district;
    }
    return DISTRICTS[0].id;
  });

  // Filter and search state for awareness cards
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.topic ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredCards = useMemo(() => {
    return HEALTH_AWARENESS_CARDS.filter((card) => {
      // Category filter
      if (selectedCategory !== "all" && card.category !== selectedCategory) {
        return false;
      }
      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const title = (isHi ? card.titleHi : card.titleEn).toLowerCase();
      const summary = (isHi ? card.summaryHi : card.summaryEn).toLowerCase();
      const points = (isHi ? card.pointsHi : card.pointsEn).join(" ").toLowerCase();
      const referral = (isHi ? card.whenToReferHi : card.whenToReferEn).toLowerCase();
      return (
        title.includes(q) ||
        summary.includes(q) ||
        points.includes(q) ||
        referral.includes(q) ||
        card.category.includes(q)
      );
    });
  }, [selectedCategory, searchQuery, isHi]);

  const districtAdvisories = useMemo(() => {
    return REGIONAL_ADVISORIES.filter((adv) => adv.districtId === selectedDistrict);
  }, [selectedDistrict]);

  const categories = [
    { id: "all", labelEn: "All Topics", labelHi: "सभी विषय" },
    { id: "fever", labelEn: "Fever & Infection", labelHi: "बुखार व संक्रमण" },
    { id: "child", labelEn: "Child Health", labelHi: "बाल स्वास्थ्य" },
    { id: "maternal", labelEn: "Maternal Health", labelHi: "मातृ स्वास्थ्य" },
    { id: "firstaid", labelEn: "First Aid & ORS", labelHi: "प्राथमिक उपचार व ओआरएस" },
    { id: "nutrition", labelEn: "Nutrition", labelHi: "पोषण व खून" },
    { id: "chronic", labelEn: "BP & Diabetes", labelHi: "बीपी व शुगर" },
  ];

  return (
    <AppFrame>
      <AppHeader
        back={{ to: "/" }}
        title={t.awarenessTitle}
        subtitle={t.awarenessSubtitle}
      />
      <main className="flex flex-1 flex-col gap-5 px-4 pb-12 pt-4 max-w-3xl mx-auto w-full">
        {/* Top Controls: Locale Switcher & Section Nav */}
        <div className="flex items-center justify-between gap-2">
          {/* Section Tabs */}
          <div className="flex rounded-[12px] bg-surface p-1 border border-line">
            <button
              type="button"
              onClick={() => setActiveTab("cards")}
              className={`flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "cards" ? "bg-pine text-paper" : "text-muted hover:text-ink"
              }`}
            >
              <BookOpen className="size-3.5" />
              <span>{isHi ? "स्वास्थ्य शिक्षा" : "Health Library"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("advisories")}
              className={`flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "advisories" ? "bg-pine text-paper" : "text-muted hover:text-ink"
              }`}
            >
              <MapPin className="size-3.5" />
              <span>{isHi ? "क्षेत्रीय अलर्ट" : "Regional Advisories"}</span>
            </button>
          </div>

          {/* Locale switcher */}
          <div className="flex gap-1 rounded-[10px] bg-surface p-0.5 border border-line">
            {(["en", "hi"] as Locale[]).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocale(loc)}
                className={`rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  locale === loc ? "bg-pine text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {loc === "en" ? t.localeNameEn : t.localeNameHi}
              </button>
            ))}
          </div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────── */}
        {/* SECTION 1: Health Literacy Library                                     */}
        {/* ────────────────────────────────────────────────────────────────────── */}
        {activeTab === "cards" && (
          <div className="flex flex-col gap-4">
            {/* Search and Category Filter */}
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isHi
                      ? "बुखार, ओआरएस, सांस, पोषण या प्राथमिक उपचार खोजें..."
                      : "Search fever, dehydration, breathing, child signs..."
                  }
                  className="pl-9 pr-4 py-2 text-sm rounded-[12px] bg-paper"
                />
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full border transition-colors ${
                      selectedCategory === cat.id
                        ? "bg-pine text-paper border-pine font-medium"
                        : "bg-paper text-muted border-line hover:border-pine/50"
                    }`}
                  >
                    {isHi ? cat.labelHi : cat.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Read-Aloud Tip */}
            <div className="flex items-center gap-2 rounded-[12px] bg-pine/5 border border-pine/20 px-3.5 py-2 text-xs text-pine">
              <Sparkles className="size-4 shrink-0" />
              <span>
                {isHi
                  ? "किसी भी कार्ड को आवाज़ में सुनने के लिए लाउडस्पीकर बटन पर टैप करें।"
                  : "Tap the loudspeaker icon on any card for offline audio read-aloud."}
              </span>
            </div>

            {/* Cards List */}
            {filteredCards.length === 0 ? (
              <div className="rounded-[16px] border border-line bg-paper p-8 text-center text-muted text-sm">
                {isHi
                  ? "कोई स्वास्थ्य कार्ड नहीं मिला। कृपया दूसरा शब्द खोजें।"
                  : "No awareness cards found matching your search."}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredCards.map((card) => (
                  <AwarenessCardItem
                    key={card.id}
                    card={card}
                    locale={locale}
                    t={t}
                    isHi={isHi}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────── */}
        {/* SECTION 2: Regional Public Health Advisories                           */}
        {/* ────────────────────────────────────────────────────────────────────── */}
        {activeTab === "advisories" && (
          <div className="flex flex-col gap-4">
            {/* Honest Static Banner */}
            <div className="rounded-[14px] border border-amber-400/30 bg-amber-400/8 px-4 py-3 flex items-start gap-2.5">
              <Info className="size-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[12px] leading-relaxed text-amber-800">
                {t.advisoriesBundledNotice}
              </p>
            </div>

            {/* District Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                <span>{t.advisoriesDistrictLabel}</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {DISTRICTS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDistrict(d.id)}
                    className={`px-2.5 py-2 rounded-[10px] text-xs font-medium border text-center transition-colors ${
                      selectedDistrict === d.id
                        ? "bg-pine text-paper border-pine"
                        : "bg-paper text-ink border-line hover:border-pine/40"
                    }`}
                  >
                    {isHi ? d.nameHi : d.nameEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Advisories for selected district */}
            <div className="flex flex-col gap-3.5 mt-1">
              {districtAdvisories.map((adv) => (
                <DistrictAdvisoryItem
                  key={adv.id}
                  advisory={adv}
                  locale={locale}
                  t={t}
                  isHi={isHi}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </AppFrame>
  );
}

function AwarenessCardItem({
  card,
  locale,
  t,
  isHi,
}: {
  card: HealthLiteracyCard;
  locale: Locale;
  t: Strings;
  isHi: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  // Format full card text for audio read-aloud
  const speakText = useMemo(() => {
    const title = isHi ? card.titleHi : card.titleEn;
    const summary = isHi ? card.summaryHi : card.summaryEn;
    const points = isHi ? card.pointsHi.join("। ") : card.pointsEn.join(". ");
    const refer = isHi
      ? `आवश्यक चेतावनी: ${card.whenToReferHi}`
      : `Urgent recommendation: ${card.whenToReferEn}`;
    return `${title}। ${summary}। ${points}। ${refer}`;
  }, [card, isHi]);

  return (
    <article className="rounded-[20px] border border-line bg-paper overflow-hidden transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3 border-b border-line/60">
        <div className="flex items-start gap-3">
          <span className="text-2xl select-none shrink-0 mt-0.5" aria-hidden>
            {card.icon}
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-ink leading-snug">
              {isHi ? card.titleHi : card.titleEn}
            </h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              {isHi ? card.summaryHi : card.summaryEn}
            </p>
          </div>
        </div>

        {/* Action button: Audio Read Aloud */}
        <div className="shrink-0">
          <SpeakerButton text={speakText} locale={locale} t={t} />
        </div>
      </div>

      {/* Body Points */}
      <div className="p-4 flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {(isHi ? card.pointsHi : card.pointsEn).map((pt, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
              <span className="text-pine font-bold select-none">•</span>
              <span>{pt}</span>
            </li>
          ))}
        </ul>

        {/* Emergency / Referral Warning Box */}
        <div className="mt-2 rounded-[12px] border border-amber-500/30 bg-amber-500/8 p-3 flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-amber-900 font-medium">
            {isHi ? card.whenToReferHi : card.whenToReferEn}
          </p>
        </div>
      </div>
    </article>
  );
}

function DistrictAdvisoryItem({
  advisory,
  locale,
  t,
  isHi,
}: {
  advisory: RegionalAdvisory;
  locale: Locale;
  t: Strings;
  isHi: boolean;
}) {
  // Format speech text for advisory
  const speakText = useMemo(() => {
    const title = isHi ? advisory.titleHi : advisory.titleEn;
    const summary = isHi ? advisory.summaryHi : advisory.summaryEn;
    const actions = isHi ? advisory.actionsHi.join("। ") : advisory.actionsEn.join(". ");
    return `${title}। ${summary}। आवश्यक कदम: ${actions}`;
  }, [advisory, isHi]);

  const categoryLabels: Record<string, { en: string; hi: string }> = {
    seasonal: { en: "Seasonal Alert", hi: "मौसमी अलर्ट" },
    vector: { en: "Vector Disease", hi: "मच्छर जनित रोग" },
    water: { en: "Clean Water", hi: "शुद्ध पेयजल" },
    maternal: { en: "Maternal Health", hi: "मातृ स्वास्थ्य" },
    child: { en: "Child Health", hi: "बाल स्वास्थ्य" },
  };

  const catMeta = categoryLabels[advisory.category] || { en: advisory.category, hi: advisory.category };

  return (
    <article className="rounded-[18px] border border-line bg-paper p-4 flex flex-col gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block text-[10px] font-semibold text-pine border border-pine/30 bg-pine/5 uppercase tracking-wide px-2 py-0.5 rounded-[6px] mb-1.5">
            {isHi ? catMeta.hi : catMeta.en}
          </span>
          <h3 className="font-display text-[15px] font-semibold text-ink leading-snug">
            {isHi ? advisory.titleHi : advisory.titleEn}
          </h3>
        </div>
        <SpeakerButton text={speakText} locale={locale} t={t} compact />
      </div>

      <p className="text-xs text-muted leading-relaxed">
        {isHi ? advisory.summaryHi : advisory.summaryEn}
      </p>

      {/* Action points */}
      <div className="rounded-[12px] bg-surface p-3 flex flex-col gap-1.5 border border-line/60">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {t.advisoriesActionsLabel}
        </p>
        <ul className="flex flex-col gap-1.5 mt-0.5">
          {(isHi ? advisory.actionsHi : advisory.actionsEn).map((action, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-ink leading-relaxed">
              <span className="text-pine font-bold">•</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Honest Source Label & Date */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line text-[11px] text-faint">
        <span className="truncate">
          🏛️ {isHi ? advisory.sourceLabelHi : advisory.sourceLabelEn}
        </span>
        <span className="shrink-0 font-mono text-[10px]">
          {t.advisoriesLastUpdated}: {advisory.lastUpdated}
        </span>
      </div>
    </article>
  );
}
