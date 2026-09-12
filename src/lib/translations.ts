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
    metricHeartRate: string;
    metricHeartRateUnit: string;
    metricHrv: string;
    metricHrvUnit: string;
    metricRespRate: string;
    metricRespRateUnit: string;
    metricRespRateNote: string;
    qualityLabel: string;
    qualityGood: string;
    qualityWeak: string;
    placeholder: string;
    secUnit: string;
    separator: string;
    faceGuide: string;
    statusLoadingModel: string;
    statusModelFallback: string;
    statusNoFace: string;
    statusMotion: string;
    statusLowLight: string;
    statusWeakSignal: string;
    measuringLabel: string;
    scanComplete: string;
    unableToDetect: string;
    unableToDetectBody: string;
    newScanButton: string;
    grantPermissionButton: string;
    permissionDeniedTitle: string;
    permissionDeniedBody: string;
    permissionUnsupportedTitle: string;
    permissionUnsupportedBody: string;
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
    // ── Task 2: Fusion screen ─────────────────────────────────────────────
    fusionTitle: string;
    fusionSelfCare: string;
    fusionPhcToday: string;
    fusionUrgent: string;
    fusionInsufficient: string;
    fusionReasonsTitle: string;
    questionnaireAge: string;
    questionnairePregnant: string;
    symptomBreathless: string;
    symptomChestPain: string;
    symptomFainting: string;
    symptomBleeding: string;
    symptomFeverDays: string;
    // ── Task 3: FET screen ────────────────────────────────────────────────
    fetTitle: string;
    fetInstruction: string;
    fetCalibrating: string;
    fetRecording: string;
    fetResult: string;
    fetNormal: string;
    fetBorderline: string;
    fetObstruction: string;
    fetRetry: string;
    micDeniedTitle: string;
    micDeniedBody: string;
    // ── Task 1: CRT screen ────────────────────────────────────────────────
    crtTitle: string;
    crtAlignNail: string;
    crtPressInstruction: string;
    crtReleaseInstruction: string;
    crtMeasuring: string;
    crtResult: string;
    crtNormal: string;
    crtBorderline: string;
    crtSlow: string;
    crtFailed: string;
    // ── Task 2: Referral slip screen ───────────────────────────────────────
    referralTitle: string;
    referralId: string;
    referralTime: string;
    referralVitals: string;
    referralReasons: string;
    referralPrint: string;
    referralDownload: string;
    referralScanMode: string;
    referralScanInstructions: string;
    referralScanUnsupported: string;
    referralNoData: string;
    referralHandoffTitle: string;
}

const en: Strings = {
    appTitle: "UniVolt Vitals",
    tagline: "Camera-based heart-rate scan (face rPPG)",
    liveBadge: "LIVE",
    metricHeartRate: "Heart Rate",
    metricHeartRateUnit: "bpm",
    metricHrv: "HRV (SDNN)",
    metricHrvUnit: "ms",
    metricRespRate: "Respiratory Rate",
    metricRespRateUnit: "/min",
    metricRespRateNote: "approx",
    qualityLabel: "Signal quality",
    qualityGood: "Good",
    qualityWeak: "Weak",
    placeholder: "--",
    secUnit: "s",
    separator: " · ",
    faceGuide: "Center your face in the oval",
    statusLoadingModel: "Loading face detector…",
    statusModelFallback: "Face detector unavailable — using skin-tone fallback",
    statusNoFace: "No face detected",
    statusMotion: "Too much movement — hold still",
    statusLowLight: "Lighting too dim",
    statusWeakSignal: "Weak pulse signal",
    measuringLabel: "Measuring",
    scanComplete: "Scan complete",
    unableToDetect: "Unable to detect",
    unableToDetectBody:
        "The signal was too noisy to measure a heart rate. Sit still, face a steady light source, and try again for the full 25 seconds.",
    newScanButton: "New Scan",
    grantPermissionButton: "Grant permission",
    permissionDeniedTitle: "Camera access is blocked",
    permissionDeniedBody:
        "UniVolt needs the front camera to measure your heart rate from your face. Grant access below to continue.",
    permissionUnsupportedTitle: "Camera not available",
    permissionUnsupportedBody:
        "This browser does not expose a camera, so the face scan cannot run.",
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
                body: "Heart rate and breathing are in the normal range. Encourage the person to drink water and rest for a few minutes.",
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
                body: "The scan could not produce a reliable reading. Move to brighter, steadier lighting, hold your face still, and run the scan again.",
            },
        },
    },
    // Task 2
    fusionTitle: "Triage Summary",
    fusionSelfCare: "Self-care at home",
    fusionPhcToday: "Visit PHC today",
    fusionUrgent: "URGENT — Go now",
    fusionInsufficient: "Insufficient data",
    fusionReasonsTitle: "Reasons",
    questionnaireAge: "Age (years)",
    questionnairePregnant: "Currently pregnant",
    symptomBreathless: "Breathlessness",
    symptomChestPain: "Chest pain",
    symptomFainting: "Fainting / loss of consciousness",
    symptomBleeding: "Bleeding (external)",
    symptomFeverDays: "Days of fever",
    // Task 3
    fetTitle: "Breathing Time Test",
    fetInstruction: "Take the deepest breath you can, then blow ALL the air out through your open mouth until your lungs feel empty.",
    fetCalibrating: "Calibrating microphone…",
    fetRecording: "Recording — keep blowing!",
    fetResult: "Result",
    fetNormal: "Normal (< 4 s)",
    fetBorderline: "Borderline (4–6 s)",
    fetObstruction: "Possible obstruction (> 6 s)",
    fetRetry: "Retry",
    micDeniedTitle: "Microphone access blocked",
    micDeniedBody: "This test needs microphone access to measure your breathing time. Please enable the microphone and try again.",
    // CRT
    crtTitle: "Capillary Refill Test",
    crtAlignNail: "Place your thumbnail in the centre box. Tap \"Ready\" when aligned.",
    crtPressInstruction: "Press your thumbnail firmly for 5 seconds, then release.",
    crtReleaseInstruction: "Release! Measuring colour recovery…",
    crtMeasuring: "Measuring…",
    crtResult: "Result",
    crtNormal: "Normal (< 2 s)",
    crtBorderline: "Borderline (2–3 s)",
    crtSlow: "Slow (≥ 3 s) — refer",
    crtFailed: "Unable to detect — lighting drift or recovery not seen",
    // Referral slip
    referralTitle: "Referral Slip",
    referralId: "Case ID",
    referralTime: "Time",
    referralVitals: "Vitals",
    referralReasons: "Clinical reasons",
    referralPrint: "Print slip",
    referralDownload: "Download PNG",
    referralScanMode: "Scan QR code",
    referralScanInstructions: "Point the camera at the QR code on the patient\u2019s slip to decode it.",
    referralScanUnsupported: "QR scanning is not supported in this browser. Use your camera app to scan.",
    referralNoData: "Complete at least one test before generating a referral.",
    referralHandoffTitle: "Patient Handoff Card",
};

const hi: Strings = {
    appTitle: "यूनिवोल्ट वाइटल्स",
    tagline: "कैमरे से चेहरे की नाड़ी जाँच (rPPG)",
    liveBadge: "लाइव",
    metricHeartRate: "हृदय गति",
    metricHeartRateUnit: "बीपीएम",
    metricHrv: "एचआरवी (SDNN)",
    metricHrvUnit: "मि.से.",
    metricRespRate: "श्वसन दर",
    metricRespRateUnit: "/मिनट",
    metricRespRateNote: "लगभग",
    qualityLabel: "सिग्नल गुणवत्ता",
    qualityGood: "अच्छी",
    qualityWeak: "कमज़ोर",
    placeholder: "--",
    secUnit: "सेकंड",
    separator: " · ",
    faceGuide: "अपना चेहरा अंडाकार के केंद्र में रखें",
    statusLoadingModel: "फेस डिटेक्टर लोड हो रहा है…",
    statusModelFallback: "फेस डिटेक्टर उपलब्ध नहीं — स्किन-टोन फ़ॉलबैक उपयोग में",
    statusNoFace: "चेहरा नहीं मिला",
    statusMotion: "बहुत हलचल — स्थिर रहें",
    statusLowLight: "रोशनी कम है",
    statusWeakSignal: "नाड़ी सिग्नल कमज़ोर",
    measuringLabel: "माप जारी",
    scanComplete: "स्कैन पूर्ण",
    unableToDetect: "पता लगाने में असमर्थ",
    unableToDetectBody:
        "हृदय गति मापने के लिए सिग्नल बहुत शोर में था। स्थिर रोशनी में बैठें, पूरे 25 सेकंड स्थिर रहें, और दोबारा प्रयास करें।",
    newScanButton: "नया स्कैन",
    grantPermissionButton: "अनुमति दें",
    permissionDeniedTitle: "कैमरे की पहुँच रुकी हुई है",
    permissionDeniedBody:
        "यूनिवोल्ट को आपकी हृदय गति चेहरे से मापने के लिए फ्रंट कैमरे की आवश्यकता है। जारी रखने के लिए नीचे अनुमति दें।",
    permissionUnsupportedTitle: "कैमरा उपलब्ध नहीं",
    permissionUnsupportedBody:
        "इस ब्राउज़र में कैमरा नहीं मिलता, इसलिए फेस स्कैन नहीं चल सकता।",
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
        referralLine:
            "कृपया शीघ्र-से-शीघ्र नज़दीकी प्राथमिक स्वास्थ्य केंद्र (PHC) पर जाएँ।",
        triage: {
            normal: {
                title: "सभी माप सामान्य",
                body: "हृदय गति और श्वसन — दोनों माप सामान्य सीमा में हैं। मरीज़ को पानी पिलाने और कुछ देर आराम करने की सलाह दें।",
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
                body: "खून में ऑक्सीजन का स्तर सामान्य से कम जान पड़ता है। मरीज़ को सीधा बैठाएँ, शांत रखें, और दोबारा जाँचें। 90% से कम होने पर तत्काल देखभाल चाहिए।",
            },
            tachypnea: {
                title: "श्वसन तेज़ (टैकिप्निया)",
                body: "साँस की दर सामान्य से तेज़ है। मरीज़ को बैठकर आराम कराएँ और पाँच मिनट बाद दोबारा गिनें। अगर तेज़ बनी रहे तो भेजें।",
            },
            inconclusive: {
                title: "पर्याप्त सिग्नल नहीं",
                body: "स्कैन से भरोसेमंद मान नहीं मिले। बेहतर, स्थिर रोशनी में जाएँ, चेहरा स्थिर रखें, और स्कैन दोबारा चलाएँ।",
            },
        },
    },
    // Task 2
    fusionTitle: "ट्राइज सारांश",
    fusionSelfCare: "घर पर स्व-देखभाल",
    fusionPhcToday: "आज PHC जाएँ",
    fusionUrgent: "तत्काल — अभी जाएँ",
    fusionInsufficient: "डेटा अपर्याप्त",
    fusionReasonsTitle: "कारण",
    questionnaireAge: "आयु (वर्ष)",
    questionnairePregnant: "वर्तमान में गर्भवती",
    symptomBreathless: "सांस फूलना",
    symptomChestPain: "सीने में दर्द",
    symptomFainting: "बेहोशी / चेतना खोना",
    symptomBleeding: "बाहरी रक्तस्राव",
    symptomFeverDays: "बुखार के दिन",
    // Task 3
    fetTitle: "श्वास समय जाँच",
    fetInstruction: "जितना हो सके उतना गहरा साँस लें, फिर मुँह खोलकर सारी हवा बाहर फूँकें जब तक फेफड़े खाली न हो जाएँ।",
    fetCalibrating: "माइक्रोफ़ोन जाँच जारी…",
    fetRecording: "रिकॉर्डिंग — फूँकते रहें!",
    fetResult: "परिणाम",
    fetNormal: "सामान्य (< 4 सेकंड)",
    fetBorderline: "सीमा रेखा (4–6 सेकंड)",
    fetObstruction: "संभावित अवरोध (> 6 सेकंड)",
    fetRetry: "दोबारा प्रयास",
    micDeniedTitle: "माइक्रोफ़ोन पहुँच अवरुद्ध",
    micDeniedBody: "इस जाँच के लिए माइक्रोफ़ोन की आवश्यकता है। कृपया अनुमति दें और पुनः प्रयास करें।",
    // CRT
    crtTitle: "कैपिलरी रिफिल जाँच",
    crtAlignNail: "अपना अंगूठा नाखुन बीच वाले बॉक्स में रखें। सही होने पर \"तैयार\" टैप करें।",
    crtPressInstruction: "अंगूठा नाखुन को 5 सेकंड जोर से दबाएँ, फिर छोड़ें।",
    crtReleaseInstruction: "छोड़ें! रंग वापसी माप जारी…",
    crtMeasuring: "माप जारी…",
    crtResult: "परिणाम",
    crtNormal: "सामान्य (< 2 सेकंड)",
    crtBorderline: "सीमा रेखा (2–3 सेकंड)",
    crtSlow: "धीमा (≥3 सेकंड) — भेजें",
    crtFailed: "पता नहीं चला — रोशनी आई या रिकवरी नहीं दिखी",
    // Referral slip
    referralTitle: "रेफरल पर्ची",
    referralId: "केस आईडी",
    referralTime: "समय",
    referralVitals: "माप",
    referralReasons: "नैदानिक कारण",
    referralPrint: "पर्ची प्रिंट करें",
    referralDownload: "PNG डाउनलोड करें",
    referralScanMode: "QR कोड स्कैन करें",
    referralScanInstructions: "मरीज़ की पर्ची का QR कोड कैमरे से स्कैन करें।",
    referralScanUnsupported: "इस ब्राउज़र में QR स्कैन उपलब्ध नहीं है। कैमरा एप से स्कैन करें।",
    referralNoData: "रेफरल तैयार करने से पहले कम से कम एक जाँच पूरी करें।",
    referralHandoffTitle: "मरीज़ हैंडऑफ कार्ड",
};

const STRINGS: Record<Locale, Strings> = { en, hi };

export function getStrings(locale: Locale): Strings {
    return STRINGS[locale] ?? STRINGS.en;
}