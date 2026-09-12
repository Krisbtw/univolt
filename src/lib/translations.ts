import type { TriageLevel } from "./triage";

export type Locale = "en" | "hi";

export interface BranchStrings {
    title: string;
    body: string;
}

export interface GuidanceStrings {
    urgentPrefix: string;
    referralLine: string;
    triage: Record<TriageLevel, BranchStrings>;
}

export interface Strings {
    appTitle: string;
    tagline: string;
    liveBadge: string;
    simulatedBadge: string;
    demoModeNotice: string;
    demoWatermark: string;
    metricHeartRate: string;
    metricHeartRateUnit: string;
    metricHrv: string;
    metricHrvUnit: string;
    metricSpo2: string;
    metricSpo2Unit: string;
    metricSpo2Note: string;
    metricRespRate: string;
    metricRespRateUnit: string;
    metricRespRateNote: string;
    placeholder: string;
    secUnit: string;
    separator: string;
    contactOverlay: string;
    readyHint: string;
    scanningLabel: string;
    pausedLabel: string;
    demoButton: string;
    newScanButton: string;
    grantPermissionButton: string;
    permissionDeniedTitle: string;
    permissionDeniedBody: string;
    permissionUnsupportedTitle: string;
    permissionUnsupportedBody: string;
    scanComplete: string;
    guidanceTitle: string;
    guidanceIntro: string;
    languageLabel: string;
    localeNameEn: string;
    localeNameHi: string;
    historyTitle: string;
    historyEmpty: string;
    clearHistoryButton: string;
    disclaimer: string;
    guidance: GuidanceStrings;
}

const en: Strings = {
    appTitle: "UniVolt Vitals",
    tagline: "Camera-based vital signs scan",
    liveBadge: "LIVE",
    simulatedBadge: "SIMULATED",
    demoModeNotice: "Demo simulation — synthetic PPG, not real measurements",
    demoWatermark: "SIMULATED — demo data, not real measurements",
    metricHeartRate: "Heart Rate",
    metricHeartRateUnit: "bpm",
    metricHrv: "HRV (SDNN)",
    metricHrvUnit: "ms",
    metricSpo2: "SpO₂",
    metricSpo2Unit: "%",
    metricSpo2Note: "estimate",
    metricRespRate: "Respiratory Rate",
    metricRespRateUnit: "/min",
    metricRespRateNote: "approx",
    placeholder: "--",
    secUnit: "s",
    separator: " · ",
    contactOverlay: "No finger detected — place finger firmly over camera lens",
    readyHint: "Place your fingertip firmly over the camera lens to begin the scan.",
    scanningLabel: "Scanning",
    pausedLabel: "Paused — waiting for finger contact",
    demoButton: "Run 12s Demo Simulation (For Laptop Judges)",
    newScanButton: "New Scan",
    grantPermissionButton: "Grant permission",
    permissionDeniedTitle: "Camera access is blocked",
    permissionDeniedBody:
        "UniVolt needs the camera to read the pulse from your fingertip. Grant access below — or run the 12-second demo simulation to see the full pipeline.",
    permissionUnsupportedTitle: "Camera not available",
    permissionUnsupportedBody:
        "This browser does not expose a camera. You can still run the demo simulation to see the full pipeline.",
    scanComplete: "Scan complete",
    guidanceTitle: "Awareness & Triage Guidance",
    guidanceIntro: "Read this aloud to the person you scanned:",
    languageLabel: "Language",
    localeNameEn: "English",
    localeNameHi: "हिंदी",
    historyTitle: "Scan history",
    historyEmpty: "No scans yet.",
    clearHistoryButton: "Clear history",
    disclaimer:
        "Not a medical device. For screening and education only — in an emergency, go to the nearest health facility.",
    guidance: {
        urgentPrefix: "URGENT — ",
        referralLine:
            "Please go to the nearest Primary Health Centre (PHC) as soon as possible.",
        triage: {
            normal: {
                title: "All vitals normal",
                body: "Heart rate, oxygen and breathing are all in the normal range. Encourage the person to drink water and rest for a few minutes.",
            },
            borderline: {
                title: "Values at the edge of normal",
                body: "One or more values sit just outside the normal range. Have the person sit and rest for five minutes, then repeat the scan.",
            },
            tachycardia: {
                title: "Fast heart rate (tachycardia)",
                body: "The heart is beating faster than normal. Keep the person seated and calm. If they feel faint, have chest pain, or the rate stays above 120, treat it as urgent.",
            },
            bradycardia: {
                title: "Slow heart rate (bradycardia)",
                body: "The heart is beating slower than expected. Ask about dizziness, tiredness or fainting — if any are present, do not wait; refer today.",
            },
            hypoxia: {
                title: "Low oxygen (possible hypoxia)",
                body: "The oxygen level in the blood appears lower than normal. Sit the person upright, keep them calm, and re-check. A level under 90% needs urgent care.",
            },
            tachypnea: {
                title: "Fast breathing (tachypnea)",
                body: "The breathing rate is faster than normal. Let the person rest seated and count the breaths again after five minutes. If still fast, refer.",
            },
            inconclusive: {
                title: "Not enough signal",
                body: "The scan could not produce reliable values. Wipe the lens, place the finger firmly over the camera, and run the scan again.",
            },
        },
    },
};

const hi: Strings = {
    appTitle: "यूनिवोल्ट वाइटल्स",
    tagline: "कैमरे से जीवन-संकेतों की जाँच",
    liveBadge: "लाइव",
    simulatedBadge: "सिम्युलेटेड",
    demoModeNotice: "डेमो सिमुलेशन — संश्लेषित सिग्नल, वास्तविक मापन नहीं",
    demoWatermark: "सिम्युलेटेड — डेमो डेटा, वास्तविक माप नहीं",
    metricHeartRate: "हृदय गति",
    metricHeartRateUnit: "बीपीएम",
    metricHrv: "एचआरवी (SDNN)",
    metricHrvUnit: "मि.से.",
    metricSpo2: "SpO₂",
    metricSpo2Unit: "%",
    metricSpo2Note: "अनुमान",
    metricRespRate: "श्वसन दर",
    metricRespRateUnit: "/मिनट",
    metricRespRateNote: "लगभग",
    placeholder: "--",
    secUnit: "सेकंड",
    separator: " · ",
    contactOverlay: "उंगली का पता नहीं चला — कृपया उंगली को कैमरे के लेंस पर दृढ़ता से रखें",
    readyHint: "स्कैन शुरू करने के लिए अपनी उंगली को कैमरे के लेंस पर दृढ़ता से रखें।",
    scanningLabel: "स्कैन हो रहा है",
    pausedLabel: "रुका हुआ — उंगली के संपर्क की प्रतीक्षा",
    demoButton: "12 सेकंड का डेमो सिमुलेशन चलाएँ (लैपटॉप पर जजों के लिए)",
    newScanButton: "नया स्कैन",
    grantPermissionButton: "अनुमति दें",
    permissionDeniedTitle: "कैमरे की पहुँच रुकी हुई है",
    permissionDeniedBody:
        "यूनिवोल्ट को उंगली से नाड़ी पढ़ने के लिए कैमरे की आवश्यकता है। नीचे अनुमति दें — या पूरी प्रक्रिया देखने के लिए 12 सेकंड का डेमो सिमुलेशन चलाएँ।",
    permissionUnsupportedTitle: "कैमरा उपलब्ध नहीं",
    permissionUnsupportedBody:
        "इस ब्राउज़र में कैमरा उपलब्ध नहीं है। पूरी प्रक्रिया देखने के लिए आप डेमो सिमुलेशन चला सकते हैं।",
    scanComplete: "स्कैन पूर्ण",
    guidanceTitle: "जागरूकता एवं ट्राइज मार्गदर्शन",
    guidanceIntro: "जाँच के बाद यह सलाह मरीज़ को सुनाएँ:",
    languageLabel: "भाषा",
    localeNameEn: "English",
    localeNameHi: "हिंदी",
    historyTitle: "स्कैन इतिहास",
    historyEmpty: "अभी तक कोई स्कैन नहीं।",
    clearHistoryButton: "इतिहास मिटाएँ",
    disclaimer:
        "यह चिकित्सा उपकरण नहीं है। केवल जाँच और शिक्षा के लिए। आपातकाल में नज़दीकी स्वास्थ्य केंद्र जाएँ।",
    guidance: {
        urgentPrefix: "तत्काल — ",
        referralLine: "कृपया शीघ्र-से-शीघ्र नज़दीकी प्राथमिक स्वास्थ्य केंद्र (PHC) पर जाएँ।",
        triage: {
            normal: {
                title: "सभी माप सामान्य",
                body: "हृदय गति, ऑक्सीजन और श्वसन — तीनों माप सामान्य सीमा में हैं। मरीज़ को पानी पिलाने और कुछ देर आराम करने की सलाह दें।",
            },
            borderline: {
                title: "माप सामान्य सीमा के किनारे",
                body: "एक या अधिक माप सामान्य सीमा के ठीक बाहर हैं। मरीज़ को पाँच मिनट आराम कराकर दोबारा स्कैन करें।",
            },
            tachycardia: {
                title: "हृदय गति तेज़ (टैकीकार्डिया)",
                body: "दिल सामान्य से तेज़ धड़क रहा है। मरीज़ को बैठाकर शांत रखें। चक्कर आना, सीने में दर्द या गति 120 से ऊपर बनी रहे तो इसे तत्काल मानें।",
            },
            bradycardia: {
                title: "हृदय गति धीमी (ब्रैडीकार्डिया)",
                body: "दिल सामान्य से धीमा धड़क रहा है। चक्कर, कमजोरी या बेहोशी के लक्षण पूछें — हों तो इंतज़ार न करें और आज ही भेजें।",
            },
            hypoxia: {
                title: "ऑक्सीजन कम (संभावित हाइपोक्सिया)",
                body: "रक्त में ऑक्सीजन सामान्य से कम प्रतीत हो रही है। मरीज़ को बैठकर आराम दें और दोबारा जाँचें। स्तर 90 से कम हो तो तत्काल उपचार चाहिए।",
            },
            tachypnea: {
                title: "साँस तेज़ (टैकीपनिया)",
                body: "श्वसन दर सामान्य से तेज़ है। मरीज़ को बैठने दें और पाँच मिनट बाद साँस फिर गिनें। अब भी तेज़ हो तो भेजें।",
            },
            inconclusive: {
                title: "संकेत अपर्याप्त",
                body: "इस स्कैन से भरोसेमंद माप नहीं मिले। लेंस साफ़ करें, उंगली को दृढ़ता से लेंस पर रखें और दोबारा स्कैन करें।",
            },
        },
    },
};

export const translations: Record<Locale, Strings> = { en, hi };

export function getStrings(locale: Locale): Strings {
    return translations[locale];
}