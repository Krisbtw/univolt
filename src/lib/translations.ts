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
export interface CommPhrase {
    id: string;
    /** Emoji icon shown on the phrase-board tile. */
    icon: string;
    /** The phrase text, spoken aloud and shown in large type when tapped. */
    text: string;
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
    // ── Trend & patient detail ────────────────────────────────────────────────
    trendTitle: string;
    trend7Day: string;
    trend30Day: string;
    trendHr: string;
    trendRr: string;
    trendSpo2: string;
    trendNeedTwoScans: string;
    spo2EmptyState: string;
    spo2ManualLabel: string;
    spo2ManualPlaceholder: string;
    spo2ManualSave: string;
    spo2ManualPoint: string;
    spo2Title: string;
    spo2AddButton: string;
    spo2StartButton: string;
    spo2Positioning: string;
    spo2Measuring: string;
    spo2TorchUnavailable: string;
    spo2CameraError: string;
    spo2NoContact: string;
    spo2Complete: string;
    spo2ResultLabel: string;
    spo2ScreeningDisclaimer: string;
    spo2Hygiene: string;
    spo2UnableBody: string;
    spo2CancelButton: string;
    spo2NewScanButton: string;
    spo2Back: string;
    spo2PatientNotFound: string;
    spo2ManualSaved: string;
    spo2UrgentReason: string;
    spo2LowReason: string;
    // ── Delta banner ───────────────────────────────────────────────────────────────────
    deltaHrUp: string;
    deltaHrDown: string;
    deltaRrUp: string;
    deltaRrDown: string;
    deltaSpo2Up: string;
    deltaSpo2Down: string;
    deltaAllStable: string;
    deltaInRange: string;
    deltaOutOfRange: string;
    // ── Visit summary (T1) ──────────────────────────────────────────────────────────────────
    visitSummaryTitle: string;
    visitSummaryGenerate: string;
    visitSummaryFirstVisit: string;
    visitSummaryCurrent: string;
    visitSummaryPrevious: string;
    visitSummaryChange: string;
    visitSummaryFollowUp: string;
    visitSummaryCopy: string;
    visitSummaryCopied: string;
    visitSummaryPrint: string;
    visitSummaryShare: string;
    visitSummaryDisclaimer: string;
    vsFollowupSelfCare: string;
    vsFollowupPhc: string;
    vsFollowupUrgent: string;
    vsFollowupDefault: string;
    vsHrUp: string;
    vsHrDown: string;
    vsRrUp: string;
    vsRrDown: string;
    vsSpo2Up: string;
    vsSpo2Down: string;
    vsAllStable: string;
    vsInRange: string;
    vsOutOfRange: string;
    // ── Emergency card (T2) ─────────────────────────────────────────────────────────────────
    emgCardTitle: string;
    emgHeading: string;
    emgBloodGroup: string;
    emgAllergies: string;
    emgConditions: string;
    emgMedication: string;
    emgLastVitals: string;
    emgLastUpdated: string;
    emgPrint: string;
    emgDownload: string;
    emgScanMode: string;
    emgScanInstructions: string;
    emgScanUnsupported: string;
    emgViewTitle: string;
    emgDisclaimer: string;
    emgEditFields: string;
    emgSave: string;
    emgNone: string;
    emgUnknown: string;
    // ── Communication Assistance (accessibility layer) ─────────────────────────────────────
    commSectionTitle: string;
    commSectionSubtitle: string;
    commProfileTitle: string;
    commCanSpeakLabel: string;
    commCanHearLabel: string;
    commCanReadLabel: string;
    commNonSpeakingNote: string;
    commModeReadAloud: string;
    commModeReadAloudDesc: string;
    commModePhraseBoard: string;
    commModePhraseBoardDesc: string;
    commModeCaptioning: string;
    commModeCaptioningDesc: string;
    commSpeakButton: string;
    commStopButton: string;
    commVoiceHindiUnavailable: string;
    commSpeechUnsupported: string;
    commReadAloudDemoText: string;
    commPhraseBoardTitle: string;
    commPhraseBoardSpokenLabel: string;
    commPhraseBoardNote: string;
    commPainLabel: string;
    commPainSentence: string;
    commCaptionTitle: string;
    commCaptionInternetBadge: string;
    commCaptionOfflineMessage: string;
    commCaptionUnsupported: string;
    commCaptionHoldToTalk: string;
    commCaptionListening: string;
    commCaptionClear: string;
    commCaptionEmptyState: string;
    commPhrases: CommPhrase[];
    commVoicePickerLabel: string;
    commVoiceAutomatic: string;
    commVoiceNoneInstalled: string;
    // ── Gesture communication prototype (canned MediaPipe vocabulary) ──────
    commModeGesture: string;
    commModeGestureDesc: string;
    commGestureOpen: string;
    gestureTitle: string;
    gestureVocabCount: string;
    gestureRoadmapNote: string;
    gestureLegendTitle: string;
    gestureStart: string;
    gestureStop: string;
    gestureLoading: string;
    gestureUnavailable: string;
    gestureCameraBlocked: string;
    gestureWaiting: string;
    gestureRecognizedLabel: string;
    gestureHistoryLabel: string;
    gestureYes: string;
    gestureNo: string;
    gestureWater: string;
    gestureHelp: string;
    gesturePainLabel: string;
    gesturePainSentence: string;
    // ── Intake questionnaire (gesture & tap mode) ──────────────────────────────
    intakeTitle: string;
    intakeCommStep: string;
    intakeCommHint: string;
    intakeCanSpeak: string;
    intakeCanHear: string;
    intakeCanRead: string;
    intakeGestureMode: string;
    intakeTapMode: string;
    intakeYes: string;
    intakeNo: string;
    intakeBack: string;
    intakeSkip: string;
    intakeDone: string;
    intakeGestureHint: string;
    intakeGestureLoading: string;
    intakeGestureUnavailable: string;
    intakeGestureCameraBlocked: string;
    intakeQBreathless: string;
    intakeQChestPain: string;
    intakeQFainting: string;
    intakeQBleeding: string;
    intakeQFever: string;
    intakeQFeverDays: string;
    intakeQPregnant: string;
    intakeQAgeBand: string;
    intakeAgeBand0: string;
    intakeAgeBand1: string;
    intakeAgeBand2: string;
    intakeAgeBand3: string;
    intakeAgeBand4: string;
    intakeSaved: string;
    // ── Staff triage view ─────────────────────────────────────────────────────
    staffTitle: string;
    staffSubtitle: string;
    staffDemoNote: string;
    staffNoPatients: string;
    staffScanQr: string;
    staffScanQrInstructions: string;
    staffScanQrUnsupported: string;
    staffManualIdLabel: string;
    staffManualIdPlaceholder: string;
    staffManualIdSubmit: string;
    staffFilterAll: string;
    staffFilterUrgent: string;
    staffFilterPhc: string;
    staffLastVisit: string;
    staffNoVitals: string;
    staffNotFound: string;
    // ── Health schemes ────────────────────────────────────────────────────────
    schemesTitle: string;
    schemesSubtitle: string;
    schemesVerifyFooter: string;
    schemesOfficialPortal: string;
    schemesWhatCovers: string;
    schemesWhoFor: string;
    schemesEnrollHow: string;
    schemesDocuments: string;
    schemesLinkFromFusion: string;
    // ── Tele-Consultation Queue ───────────────────────────────────────────────
    consultRequestBtn: string;
    consultRequestedSuccess: string;
    consultQueueTab: string;
    triageListTab: string;
    consultShareBtn: string;
    consultShareNote: string;
    consultStatusRequested: string;
    consultStatusSent: string;
    consultStatusCompleted: string;
    consultMarkSent: string;
    consultMarkCompleted: string;
    consultAddNote: string;
    consultNotesLabel: string;
    consultNoRequests: string;
    consultCopied: string;
    consultPacketTitle: string;
    consultDisclaimer: string;
    // ── Health Awareness & Regional Advisories ────────────────────────────────
    awarenessNav: string;
    awarenessTitle: string;
    awarenessSubtitle: string;
    awarenessListenBtn: string;
    awarenessStopBtn: string;
    advisoriesTitle: string;
    advisoriesBundledNotice: string;
    advisoriesDistrictLabel: string;
    advisoriesLastUpdated: string;
    advisoriesActionsLabel: string;
    advisoriesSeeFeverLink: string;
    // ── EMR-Lite & Clinic Backup ──────────────────────────────────────────────
    manualVitalsTitle: string;
    manualVitalsDesc: string;
    bpSystolicLabel: string;
    bpDiastolicLabel: string;
    tempLabel: string;
    manualSaveBtn: string;
    manualVitalsSaved: string;
    sourceCamera: string;
    sourceManual: string;
    timelineTitle: string;
    timelineSubtitle: string;
    timelineEmpty: string;
    backupExportBtn: string;
    backupImportBtn: string;
    backupImportSuccess: string;
    backupImportError: string;
    priorityUrgent: string;
    priorityReview: string;
    priorityRoutine: string;
}

const en: Strings = {
    appTitle: "UniCare Vitals",
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
    // Trend & patient detail
    trendTitle: "Vitals Trend",
    trend7Day: "7 days",
    trend30Day: "30 days",
    trendHr: "Heart Rate",
    trendRr: "Respiratory Rate",
    trendSpo2: "SpO₂ (manual only)",
    trendNeedTwoScans: "Run another scan to start a trend.",
    spo2EmptyState: "SpO₂ not measured — enter a reading if you have a pulse oximeter.",
    spo2ManualLabel: "Enter pulse-oximeter SpO₂",
    spo2ManualPlaceholder: "e.g. 98",
    spo2ManualSave: "Save reading",
    spo2ManualPoint: "Manual",
    spo2Title: "Fingertip SpO₂ scan",
    spo2AddButton: "Add SpO₂ (fingertip, ~20 s)",
    spo2StartButton: "Start SpO₂ scan",
    spo2Positioning: "Place your fingertip firmly over the rear camera lens",
    spo2Measuring: "Keep your fingertip still",
    spo2TorchUnavailable: "Fingertip scan is not available on this device. Enter a pulse-oximeter reading instead.",
    spo2CameraError: "Camera access is needed for the fingertip scan. Enter a pulse-oximeter reading instead.",
    spo2NoContact: "No fingertip contact detected",
    spo2Complete: "SpO₂ scan complete",
    spo2ResultLabel: "SpO₂ estimate",
    spo2ScreeningDisclaimer: "Screening only, not a certified pulse oximeter",
    spo2Hygiene: "Sanitize the camera lens between patients",
    spo2UnableBody: "The fingertip signal was not strong enough to produce a reliable estimate. Try again or enter a pulse-oximeter reading.",
    spo2CancelButton: "Cancel scan",
    spo2NewScanButton: "New SpO₂ scan",
    spo2Back: "Back",
    spo2PatientNotFound: "Patient not found",
    spo2ManualSaved: "Saved",
    spo2UrgentReason: "SpO₂ < 90%",
    spo2LowReason: "SpO₂ 90–94%",
    // Delta banner
    deltaHrUp: "Heart rate up {delta} bpm; {range}.",
    deltaHrDown: "Heart rate down {delta} bpm; {range}.",
    deltaRrUp: "Respiratory rate up {delta} /min; {range}.",
    deltaRrDown: "Respiratory rate down {delta} /min; {range}.",
    deltaSpo2Up: "SpO₂ improved {delta}%; {range}.",
    deltaSpo2Down: "SpO₂ decreased {delta}%; {range}.",
    deltaAllStable: "Vitals remain within expected range.",
    deltaInRange: "still within normal range",
    deltaOutOfRange: "outside normal range — monitor closely",
    // Visit summary
    visitSummaryTitle: "Clinical Visit Summary",
    visitSummaryGenerate: "Generate Visit Summary",
    visitSummaryFirstVisit: "First visit",
    visitSummaryCurrent: "Current visit",
    visitSummaryPrevious: "Previous visit",
    visitSummaryChange: "Change",
    visitSummaryFollowUp: "Follow-up",
    visitSummaryCopy: "Copy",
    visitSummaryCopied: "Copied!",
    visitSummaryPrint: "Print",
    visitSummaryShare: "Share",
    visitSummaryDisclaimer: "Not a medical device. Clinical visit notes for screening only. Confirm findings with trained clinical staff.",
    vsFollowupSelfCare: "Routine monitoring.",
    vsFollowupPhc: "Follow-up at the nearest PHC today.",
    vsFollowupUrgent: "Urgent referral advised.",
    vsFollowupDefault: "Repeat the scan after rest.",
    vsHrUp: "Heart rate increased {delta} bpm; {range}.",
    vsHrDown: "Heart rate decreased {delta} bpm; {range}.",
    vsRrUp: "Respiratory rate increased {delta} /min; {range}.",
    vsRrDown: "Respiratory rate decreased {delta} /min; {range}.",
    vsSpo2Up: "SpO₂ improved by {delta}%; {range}.",
    vsSpo2Down: "SpO₂ decreased {delta}%; {range}.",
    vsAllStable: "Vitals remain within expected range.",
    vsInRange: "still within normal range",
    vsOutOfRange: "outside normal range — monitor closely",
    // Emergency card
    emgCardTitle: "Emergency Card",
    emgHeading: "⚠️ EMERGENCY INFORMATION",
    emgBloodGroup: "Blood Group",
    emgAllergies: "Allergies",
    emgConditions: "Conditions",
    emgMedication: "Current Medication",
    emgLastVitals: "Latest Vitals",
    emgLastUpdated: "Last updated",
    emgPrint: "Print card",
    emgDownload: "Download PNG",
    emgScanMode: "Scan emergency QR",
    emgScanInstructions: "Scan a printed emergency card QR to view patient information.",
    emgScanUnsupported: "QR scanning not supported. Use your camera app.",
    emgViewTitle: "Emergency Patient Info",
    emgDisclaimer: "This QR contains no name or contact details. Anyone who scans it can view this information — that is intentional so emergency responders can access it without authentication.",
    emgEditFields: "Edit emergency info",
    emgSave: "Save",
    emgNone: "None on file",
    emgUnknown: "Unknown",
    // Communication Assistance
    commSectionTitle: "Communication Assistance",
    commSectionSubtitle: "Tools for patients who cannot speak, cannot hear, or cannot read.",
    commProfileTitle: "Communication profile",
    commCanSpeakLabel: "Can speak",
    commCanHearLabel: "Can hear",
    commCanReadLabel: "Can read",
    commNonSpeakingNote: "Patient marked as non-speaking — vocal tests not applicable",
    commModeReadAloud: "Read aloud",
    commModeReadAloudDesc: "Speaks any guidance or instruction card out loud on tap. Works fully offline.",
    commModePhraseBoard: "Phrase board",
    commModePhraseBoardDesc: "Tap a phrase or a pain number to speak it out loud for the clinician.",
    commModeCaptioning: "Live captioning",
    commModeCaptioningDesc: "Turns the clinician's speech into large on-screen text.",
    commSpeakButton: "Read aloud",
    commStopButton: "Stop",
    commVoiceHindiUnavailable: "Hindi voice not available on this device — using English instead",
    commSpeechUnsupported: "Speech playback is not supported in this browser.",
    commReadAloudDemoText:
        "Tap the speaker icon on any guidance or instruction card to hear it read aloud, any time.",
    commPhraseBoardTitle: "Tap to speak",
    commPhraseBoardSpokenLabel: "Patient is saying:",
    commPhraseBoardNote: "Full sign-language recognition is on the roadmap.",
    commPainLabel: "Pain level (0–10)",
    commPainSentence: "Pain level {level}",
    commCaptionTitle: "Live captioning",
    commCaptionInternetBadge: "Requires internet",
    commCaptionOfflineMessage:
        "No internet connection — live captioning needs a data or Wi-Fi connection and is disabled right now.",
    commCaptionUnsupported: "Live captioning is not supported in this browser.",
    commCaptionHoldToTalk: "Hold to talk",
    commCaptionListening: "Listening…",
    commCaptionClear: "Clear",
    commCaptionEmptyState: "Press and hold the mic to start captioning.",
    commPhrases: [
        { id: "chest-pain", icon: "🫀", text: "Chest pain" },
        { id: "dizziness", icon: "💫", text: "Dizziness" },
        { id: "cant-breathe", icon: "🌬️", text: "I can't breathe" },
        { id: "water", icon: "💧", text: "Water" },
        { id: "bathroom", icon: "🚻", text: "Bathroom" },
        { id: "call-family", icon: "👪", text: "Call my family" },
        { id: "yes", icon: "✅", text: "Yes" },
        { id: "no", icon: "❌", text: "No" },
        { id: "since-morning", icon: "🌅", text: "Since this morning" },
        { id: "since-yesterday", icon: "🌙", text: "Since yesterday" },
        { id: "fever", icon: "🤒", text: "Fever" },
        { id: "vomiting", icon: "🤮", text: "Vomiting" },
        { id: "headache", icon: "🤕", text: "Headache" },
        { id: "weakness", icon: "😩", text: "Weakness" },
        { id: "stomach-pain", icon: "🍽️", text: "Stomach pain" },
        { id: "cough", icon: "😮‍💨", text: "Cough" },
        { id: "allergic-reaction", icon: "🚨", text: "Allergic reaction" },
        { id: "pregnant", icon: "🤰", text: "I am pregnant" },
        { id: "bleeding", icon: "🩸", text: "Bleeding" },
        { id: "help", icon: "⚠️", text: "Help me" },
    ],
    commVoicePickerLabel: "Voice",
    commVoiceAutomatic: "Automatic",
    commVoiceNoneInstalled: "No speech voices are installed on this device.",
    // Gesture communication prototype
    commModeGesture: "Gesture prototype",
    commModeGestureDesc:
        "Camera reads four fixed hand gestures and speaks the matching phrase. A limited prototype, not sign-language translation.",
    commGestureOpen: "Open gesture screen",
    gestureTitle: "Gesture communication — prototype",
    gestureVocabCount: "Fixed vocabulary: 4 gestures",
    gestureRoadmapNote:
        "Limited gesture vocabulary — not full sign-language recognition. Full ISL recognition requires a trained sign-language model (roadmap).",
    gestureLegendTitle: "Gesture legend",
    gestureStart: "Start camera",
    gestureStop: "Stop camera",
    gestureLoading: "Loading gesture model…",
    gestureUnavailable: "Gesture recognition is unavailable on this device.",
    gestureCameraBlocked: "Camera access is blocked. Allow the camera to use gesture communication.",
    gestureWaiting: "Hold a gesture steady for half a second…",
    gestureRecognizedLabel: "Patient is saying:",
    gestureHistoryLabel: "Recent",
    gestureYes: "Yes",
    gestureNo: "No",
    gestureWater: "I need water",
    gestureHelp: "Please help me",
    gesturePainLabel: "Show 1–5 fingers for a pain level",
    gesturePainSentence: "Pain level {level}",
    // Intake questionnaire
    intakeTitle: "Health intake",
    intakeCommStep: "Communication needs",
    intakeCommHint: "Select any that apply. This is stored on the patient record.",
    intakeCanSpeak: "Can speak",
    intakeCanHear: "Can hear",
    intakeCanRead: "Can read",
    intakeGestureMode: "Gesture mode — patient answers by showing 👍 (Yes) or 👎 (No)",
    intakeTapMode: "Tap Yes or No to answer each question",
    intakeYes: "YES ✓",
    intakeNo: "NO ✕",
    intakeBack: "Back",
    intakeSkip: "Skip",
    intakeDone: "Save intake",
    intakeGestureHint: "No gesture detected — you can tap instead",
    intakeGestureLoading: "Loading gesture model…",
    intakeGestureUnavailable: "Gesture recognition unavailable on this device",
    intakeGestureCameraBlocked: "Camera access blocked — tap Yes or No to continue",
    intakeQBreathless: "Feeling short of breath?",
    intakeQChestPain: "Any chest pain?",
    intakeQFainting: "Felt faint or lost consciousness?",
    intakeQBleeding: "Any external bleeding?",
    intakeQFever: "Fever?",
    intakeQFeverDays: "Fever for more than 3 days?",
    intakeQPregnant: "Currently pregnant?",
    intakeQAgeBand: "Age group",
    intakeAgeBand0: "Child (under 12)",
    intakeAgeBand1: "Teen (12–17)",
    intakeAgeBand2: "Adult (18–59)",
    intakeAgeBand3: "Senior (60–74)",
    intakeAgeBand4: "Elder (75+)",
    intakeSaved: "Intake saved",
    // Staff triage view
    staffTitle: "Staff triage view",
    staffSubtitle: "For review by a clinician. Not a diagnosis. For review between doctor visits.",
    staffDemoNote: "Shared clinic tablet — demo",
    staffNoPatients: "No patients registered yet.",
    staffScanQr: "Scan patient QR",
    staffScanQrInstructions: "Point the camera at the patient\u2019s QR code or emergency card.",
    staffScanQrUnsupported: "QR scanning not supported in this browser. Enter the patient ID below.",
    staffManualIdLabel: "Patient ID",
    staffManualIdPlaceholder: "e.g. UV-001",
    staffManualIdSubmit: "Go to patient",
    staffFilterAll: "All",
    staffFilterUrgent: "Urgent",
    staffFilterPhc: "PHC today",
    staffLastVisit: "Last visit",
    staffNoVitals: "No vitals yet",
    staffNotFound: "Patient not found",
    // Health schemes
    schemesTitle: "Government health schemes",
    schemesSubtitle: "Real Indian government schemes relevant to rural patients. Informational only.",
    schemesVerifyFooter: "Verify details on the official portal.",
    schemesOfficialPortal: "Official portal",
    schemesWhatCovers: "What it covers",
    schemesWhoFor: "Who it\u2019s for",
    schemesEnrollHow: "How to enroll",
    schemesDocuments: "Documents needed",
    schemesLinkFromFusion: "See applicable health schemes →",
    // ── Tele-Consultation Queue ───────────────────────────────────────────────
    consultRequestBtn: "Request Tele-Consult",
    consultRequestedSuccess: "Tele-consult requested ✓",
    consultQueueTab: "Consult queue",
    triageListTab: "Triage list",
    consultShareBtn: "Share consult summary",
    consultShareNote: "Store-and-forward consult — hand the summary to the doctor by WhatsApp/SMS or at the next visit.",
    consultStatusRequested: "Requested",
    consultStatusSent: "Sent to doctor",
    consultStatusCompleted: "Completed",
    consultMarkSent: "Mark sent to doctor",
    consultMarkCompleted: "Mark completed",
    consultAddNote: "Add clinician note…",
    consultNotesLabel: "Clinician note",
    consultNoRequests: "No pending tele-consult requests in queue.",
    consultCopied: "Consult summary copied to clipboard!",
    consultPacketTitle: "STORE-AND-FORWARD TELE-CONSULT PACKET",
    consultDisclaimer: "Store-and-forward screening summary. Confirm findings with clinical evaluation.",
    // ── Health Awareness & Regional Advisories ────────────────────────────────
    awarenessNav: "Awareness",
    awarenessTitle: "Rural Health Literacy & Awareness",
    awarenessSubtitle: "Essential preventative care guidance for rural communities. Listen or read.",
    awarenessListenBtn: "Read aloud",
    awarenessStopBtn: "Stop audio",
    advisoriesTitle: "Regional Public Health Advisories",
    advisoriesBundledNotice: "Bundled advisories — updated when the clinic device is online.",
    advisoriesDistrictLabel: "Select district",
    advisoriesLastUpdated: "Updated",
    advisoriesActionsLabel: "Recommended actions",
    advisoriesSeeFeverLink: "See fever & seasonal advisories →",
    // ── EMR-Lite & Clinic Backup ──────────────────────────────────────────────
    manualVitalsTitle: "Measured with clinic equipment",
    manualVitalsDesc: "Enter readings taken using a blood pressure cuff, clinical thermometer, or pulse oximeter.",
    bpSystolicLabel: "Systolic (mmHg)",
    bpDiastolicLabel: "Diastolic (mmHg)",
    tempLabel: "Temperature (°C)",
    manualSaveBtn: "Save manual vitals",
    manualVitalsSaved: "Manual vitals recorded ✓",
    sourceCamera: "Camera scan",
    sourceManual: "Equipment (Manual)",
    timelineTitle: "Unified Patient History",
    timelineSubtitle: "Chronological visit records, vitals, and consult status.",
    timelineEmpty: "No clinical events recorded for this patient yet.",
    backupExportBtn: "Export clinic backup",
    backupImportBtn: "Import backup",
    backupImportSuccess: "Clinic backup restored successfully!",
    backupImportError: "Invalid backup file.",
    priorityUrgent: "Urgent (Red)",
    priorityReview: "Review (Yellow)",
    priorityRoutine: "Routine (Green)",
};

const hi: Strings = {
    appTitle: "यूनिकेयर वाइटल्स",
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
    // Trend & patient detail
    trendTitle: "वाइटल ट्रेंड",
    trend7Day: "7 दिन",
    trend30Day: "30 दिन",
    trendHr: "हृदय गति",
    trendRr: "श्वसन दर",
    trendSpo2: "SpO₂ (केवल क्रमांकित)",
    trendNeedTwoScans: "ट्रेंड शुरू करने के लिए एक और स्कैन करें।",
    spo2EmptyState: "SpO₂ नहीं मापा — यदि पास में पल्स ऑक्सीमीटर है तो रीडिंग दर्ज करें।",
    spo2ManualLabel: "पल्स ऑक्सीमीटर SpO₂ दर्ज करें",
    spo2ManualPlaceholder: "जैसे 98",
    spo2ManualSave: "रीडिंग सेव करें",
    spo2ManualPoint: "क्रमांकित",
    spo2Title: "उंगली से SpO₂ जाँच",
    spo2AddButton: "SpO₂ जोड़ें (उंगली, लगभग 20 सेकंड)",
    spo2StartButton: "SpO₂ जाँच शुरू करें",
    spo2Positioning: "अपनी उंगली को पीछे के कैमरा लेंस पर मजबूती से रखें",
    spo2Measuring: "उंगली को स्थिर रखें",
    spo2TorchUnavailable: "इस डिवाइस पर उंगली की जाँच उपलब्ध नहीं है। इसके बजाय पल्स-ऑक्सीमीटर की रीडिंग दर्ज करें।",
    spo2CameraError: "उंगली की जाँच के लिए कैमरा अनुमति चाहिए। इसके बजाय पल्स-ऑक्सीमीटर की रीडिंग दर्ज करें।",
    spo2NoContact: "उंगली का संपर्क नहीं मिला",
    spo2Complete: "SpO₂ जाँच पूरी",
    spo2ResultLabel: "SpO₂ अनुमान",
    spo2ScreeningDisclaimer: "केवल स्क्रीनिंग, प्रमाणित पल्स ऑक्सीमीटर नहीं",
    spo2Hygiene: "मरीज़ों के बीच कैमरा लेंस को साफ़ करें",
    spo2UnableBody: "उंगली का सिग्नल भरोसेमंद अनुमान के लिए पर्याप्त नहीं था। फिर प्रयास करें या पल्स-ऑक्सीमीटर की रीडिंग दर्ज करें।",
    spo2CancelButton: "जाँच रद्द करें",
    spo2NewScanButton: "नई SpO₂ जाँच",
    spo2Back: "वापस",
    spo2PatientNotFound: "मरीज़ नहीं मिला",
    spo2ManualSaved: "सेव हो गया",
    spo2UrgentReason: "SpO₂ < 90%",
    spo2LowReason: "SpO₂ 90–94%",
    // Delta banner
    deltaHrUp: "हृदय गति {delta} bpm बढ़ी; {range}.",
    deltaHrDown: "हृदय गति {delta} bpm घटी; {range}.",
    deltaRrUp: "श्वसन दर {delta} /min बढ़ा; {range}.",
    deltaRrDown: "श्वसन दर {delta} /min घटा; {range}.",
    deltaSpo2Up: "SpO₂ {delta}% सुधरा; {range}.",
    deltaSpo2Down: "SpO₂ {delta}% घटा; {range}.",
    deltaAllStable: "वाइटल सामान्य सीमा में हैं।",
    deltaInRange: "सामान्य सीमा में",
    deltaOutOfRange: "सामान्य सीमा से बाहर",
    // Visit summary
    visitSummaryTitle: "नैदानिक भेंट सारांश",
    visitSummaryGenerate: "भेंट सारांश तैयार करें",
    visitSummaryFirstVisit: "पहली भेंट",
    visitSummaryCurrent: "वर्तमान भेंट",
    visitSummaryPrevious: "पिछली भेंट",
    visitSummaryChange: "बदलाव",
    visitSummaryFollowUp: "फॉलो-अप",
    visitSummaryCopy: "कॉपी करें",
    visitSummaryCopied: "कॉपी हो गई!",
    visitSummaryPrint: "प्रिंट करें",
    visitSummaryShare: "शेयर करें",
    visitSummaryDisclaimer: "यह चिकित्सा उपकरण नहीं है। केवल स्क्रीनिंग के लिए।",
    vsFollowupSelfCare: "नियमित निगरानी जारी रखें।",
    vsFollowupPhc: "आज नजदीकी PHC जाएँ।",
    vsFollowupUrgent: "तत्काल रेफरल आवश्यक।",
    vsFollowupDefault: "आराम के बाद पुनः स्कैन करें।",
    vsHrUp: "हृदय गति {delta} bpm बढ़ी; {range}.",
    vsHrDown: "हृदय गति {delta} bpm घटी; {range}.",
    vsRrUp: "श्वसन दर {delta} /min बढ़ा; {range}.",
    vsRrDown: "श्वसन दर {delta} /min घटा; {range}.",
    vsSpo2Up: "SpO₂ {delta}% सुधरा; {range}.",
    vsSpo2Down: "SpO₂ {delta}% घटा; {range}.",
    vsAllStable: "वाइटल सामान्य सीमा में हैं।",
    vsInRange: "सामान्य सीमा में",
    vsOutOfRange: "सामान्य सीमा से बाहर",
    // Emergency card
    emgCardTitle: "आपात कार्ड",
    emgHeading: "⚠️ आपातकालीन जानकारी",
    emgBloodGroup: "रक्त समूह",
    emgAllergies: "एलर्जी",
    emgConditions: "स्थितियाँ",
    emgMedication: "वर्तमान दवाईयाँ",
    emgLastVitals: "नवीनतम वाइटल",
    emgLastUpdated: "अंतिम अपडेट",
    emgPrint: "कार्ड प्रिंट करें",
    emgDownload: "PNG डाउनलोड करें",
    emgScanMode: "आपात QR स्कैन करें",
    emgScanInstructions: "आपात कार्ड QR स्कैन करें।",
    emgScanUnsupported: "QR स्कैन उपलब्ध नहीं। कैमरा एप से स्कैन करें।",
    emgViewTitle: "आपात मरीज़ जानकारी",
    emgDisclaimer: "इस QR में नाम या संपर्क जानकारी नहीं है। इसे स्कैन करने वाला कोई भी यह डेटा देख सकता है।",
    emgEditFields: "आपात जानकारी संपादित करें",
    emgSave: "सेव करें",
    emgNone: "कोई नहीं",
    emgUnknown: "अज्ञात",
    // Communication Assistance
    commSectionTitle: "संचार सहायता",
    commSectionSubtitle: "उन मरीज़ों के लिए उपकरण जो बोल, सुन या पढ़ नहीं सकते।",
    commProfileTitle: "संचार प्रोफ़ाइल",
    commCanSpeakLabel: "बोल सकते हैं",
    commCanHearLabel: "सुन सकते हैं",
    commCanReadLabel: "पढ़ सकते हैं",
    commNonSpeakingNote: "मरीज़ को गैर-वाचिक (non-speaking) चिह्नित किया गया है — वाचिक जाँच लागू नहीं",
    commModeReadAloud: "ज़ोर से पढ़ें",
    commModeReadAloudDesc: "टैप करने पर किसी भी मार्गदर्शन या निर्देश कार्ड को ज़ोर से पढ़ता है। पूरी तरह ऑफ़लाइन काम करता है।",
    commModePhraseBoard: "वाक्यांश बोर्ड",
    commModePhraseBoardDesc: "चिकित्सक के लिए वाक्यांश या दर्द का स्तर टैप करके सुनाएँ।",
    commModeCaptioning: "लाइव कैप्शनिंग",
    commModeCaptioningDesc: "चिकित्सक की बात को बड़े अक्षरों में स्क्रीन पर दिखाता है।",
    commSpeakButton: "ज़ोर से पढ़ें",
    commStopButton: "रोकें",
    commVoiceHindiUnavailable: "इस डिवाइस पर हिंदी आवाज़ उपलब्ध नहीं — अंग्रेज़ी में सुनाया जा रहा है",
    commSpeechUnsupported: "इस ब्राउज़र में आवाज़ चलाना उपलब्ध नहीं है।",
    commReadAloudDemoText:
        "किसी भी मार्गदर्शन या निर्देश कार्ड पर स्पीकर आइकन टैप करके, कभी भी उसे सुनें।",
    commPhraseBoardTitle: "बोलने के लिए टैप करें",
    commPhraseBoardSpokenLabel: "मरीज़ कह रहा है:",
    commPhraseBoardNote: "पूर्ण सांकेतिक-भाषा पहचान रोडमैप में है।",
    commPainLabel: "दर्द का स्तर (0–10)",
    commPainSentence: "दर्द का स्तर {level}",
    commCaptionTitle: "लाइव कैप्शनिंग",
    commCaptionInternetBadge: "इंटरनेट आवश्यक",
    commCaptionOfflineMessage:
        "इंटरनेट कनेक्शन नहीं है — लाइव कैप्शनिंग के लिए डेटा या वाई-फ़ाई ज़रूरी है, इसलिए अभी बंद है।",
    commCaptionUnsupported: "इस ब्राउज़र में लाइव कैप्शनिंग उपलब्ध नहीं है।",
    commCaptionHoldToTalk: "बोलने के लिए दबाए रखें",
    commCaptionListening: "सुन रहा है…",
    commCaptionClear: "मिटाएँ",
    commCaptionEmptyState: "कैप्शनिंग शुरू करने के लिए माइक दबाकर रखें।",
    commPhrases: [
        { id: "chest-pain", icon: "🫀", text: "सीने में दर्द" },
        { id: "dizziness", icon: "💫", text: "चक्कर आना" },
        { id: "cant-breathe", icon: "🌬️", text: "मुझे साँस नहीं आ रही" },
        { id: "water", icon: "💧", text: "पानी" },
        { id: "bathroom", icon: "🚻", text: "शौचालय" },
        { id: "call-family", icon: "👪", text: "मेरे परिवार को बुलाओ" },
        { id: "yes", icon: "✅", text: "हाँ" },
        { id: "no", icon: "❌", text: "नहीं" },
        { id: "since-morning", icon: "🌅", text: "आज सुबह से" },
        { id: "since-yesterday", icon: "🌙", text: "कल से" },
        { id: "fever", icon: "🤒", text: "बुखार" },
        { id: "vomiting", icon: "🤮", text: "उल्टी" },
        { id: "headache", icon: "🤕", text: "सिरदर्द" },
        { id: "weakness", icon: "😩", text: "कमज़ोरी" },
        { id: "stomach-pain", icon: "🍽️", text: "पेट दर्द" },
        { id: "cough", icon: "😮‍💨", text: "खाँसी" },
        { id: "allergic-reaction", icon: "🚨", text: "एलर्जी प्रतिक्रिया" },
        { id: "pregnant", icon: "🤰", text: "मैं गर्भवती हूँ" },
        { id: "bleeding", icon: "🩸", text: "खून बह रहा है" },
        { id: "help", icon: "⚠️", text: "मदद करो" },
    ],
    commVoicePickerLabel: "आवाज़",
    commVoiceAutomatic: "स्वचालित",
    commVoiceNoneInstalled: "इस डिवाइस में कोई बोलने वाली आवाज़ इंस्टॉल नहीं है।",
    // Gesture communication prototype
    commModeGesture: "इशारा प्रोटोटाइप",
    commModeGestureDesc:
        "कैमरा चार निश्चित हाथ के इशारे पहचानता है और संबंधित वाक्य बोलता है। यह सीमित प्रोटोटाइप है, सांकेतिक-भाषा अनुवाद नहीं।",
    commGestureOpen: "इशारा स्क्रीन खोलें",
    gestureTitle: "इशारा संचार — प्रोटोटाइप",
    gestureVocabCount: "निश्चित शब्दावली: 4 इशारे",
    gestureRoadmapNote:
        "सीमित इशारा शब्दावली — पूर्ण सांकेतिक-भाषा पहचान नहीं। पूर्ण ISL पहचान के लिए प्रशिक्षित सांकेतिक-भाषा मॉडल आवश्यक है (रोडमैप)।",
    gestureLegendTitle: "इशारों की सूची",
    gestureStart: "कैमरा चालू करें",
    gestureStop: "कैमरा बंद करें",
    gestureLoading: "इशारा मॉडल लोड हो रहा है…",
    gestureUnavailable: "इस डिवाइस पर इशारा पहचान उपलब्ध नहीं है।",
    gestureCameraBlocked: "कैमरा अनुमति बंद है। इशारा संचार के लिए कैमरा चालू करें।",
    gestureWaiting: "आधे सेकंड तक इशारा स्थिर रखें…",
    gestureRecognizedLabel: "मरीज़ कह रहा है:",
    gestureHistoryLabel: "हाल के",
    gestureYes: "हाँ",
    gestureNo: "नहीं",
    gestureWater: "मुझे पानी चाहिए",
    gestureHelp: "कृपया मेरी मदद करें",
    gesturePainLabel: "दर्द का स्तर बताने के लिए 1–5 उँगलियाँ दिखाएँ",
    gesturePainSentence: "दर्द का स्तर {level}",
    // Intake questionnaire
    intakeTitle: "स्वास्थ्य जानकारी",
    intakeCommStep: "संचार ज़रूरतें",
    intakeCommHint: "जो भी लागू हो चुनें। यह मरीज़ के रिकॉर्ड में सेव होगा।",
    intakeCanSpeak: "बोल सकते हैं",
    intakeCanHear: "सुन सकते हैं",
    intakeCanRead: "पढ़ सकते हैं",
    intakeGestureMode: "इशारा मोड — मरीज़ 👍 (हाँ) या 👎 (नहीं) इशारा करके जवाब दें",
    intakeTapMode: "हर सवाल पर हाँ या नहीं टैप करें",
    intakeYes: "हाँ ✓",
    intakeNo: "नहीं ✕",
    intakeBack: "वापस",
    intakeSkip: "छोड़ें",
    intakeDone: "जानकारी सेव करें",
    intakeGestureHint: "इशारा नहीं मिला — आप टैप भी कर सकते हैं",
    intakeGestureLoading: "इशारा मॉडल लोड हो रहा है…",
    intakeGestureUnavailable: "इस डिवाइस पर इशारा पहचान उपलब्ध नहीं",
    intakeGestureCameraBlocked: "कैमरा अनुमति बंद है — जारी रखने के लिए हाँ या नहीं टैप करें",
    intakeQBreathless: "साँस फूल रही है?",
    intakeQChestPain: "सीने में दर्द है?",
    intakeQFainting: "चक्कर आया या होश खोया?",
    intakeQBleeding: "बाहरी खून बह रहा है?",
    intakeQFever: "बुखार है?",
    intakeQFeverDays: "3 दिन से ज़्यादा बुखार है?",
    intakeQPregnant: "अभी गर्भवती हैं?",
    intakeQAgeBand: "आयु वर्ग",
    intakeAgeBand0: "बच्चा (12 से कम)",
    intakeAgeBand1: "किशोर (12–17)",
    intakeAgeBand2: "वयस्क (18–59)",
    intakeAgeBand3: "वरिष्ठ (60–74)",
    intakeAgeBand4: "बुज़ुर्ग (75+)",
    intakeSaved: "जानकारी सेव हो गई",
    // Staff triage view
    staffTitle: "स्टाफ ट्राइज व्यू",
    staffSubtitle: "चिकित्सक द्वारा समीक्षा के लिए। यह निदान नहीं है। डॉक्टर के दौरे के बीच समीक्षा के लिए।",
    staffDemoNote: "साझा क्लिनिक टैबलेट — डेमो",
    staffNoPatients: "अभी तक कोई मरीज़ पंजीकृत नहीं।",
    staffScanQr: "मरीज़ QR स्कैन करें",
    staffScanQrInstructions: "मरीज़ के QR कोड या आपात कार्ड पर कैमरा लगाएँ।",
    staffScanQrUnsupported: "इस ब्राउज़र में QR स्कैन उपलब्ध नहीं। नीचे मरीज़ ID दर्ज करें।",
    staffManualIdLabel: "मरीज़ ID",
    staffManualIdPlaceholder: "जैसे UV-001",
    staffManualIdSubmit: "मरीज़ खोलें",
    staffFilterAll: "सभी",
    staffFilterUrgent: "तत्काल",
    staffFilterPhc: "आज PHC",
    staffLastVisit: "अंतिम भेंट",
    staffNoVitals: "अभी कोई माप नहीं",
    staffNotFound: "मरीज़ नहीं मिला",
    // Health schemes
    schemesTitle: "सरकारी स्वास्थ्य योजनाएँ",
    schemesSubtitle: "ग्रामीण मरीज़ों के लिए प्रासंगिक वास्तविक भारतीय सरकारी योजनाएँ। केवल जानकारी के लिए।",
    schemesVerifyFooter: "आधिकारिक पोर्टल पर विवरण सत्यापित करें।",
    schemesOfficialPortal: "आधिकारिक पोर्टल",
    schemesWhatCovers: "क्या कवर करती है",
    schemesWhoFor: "किसके लिए है",
    schemesEnrollHow: "कैसे नामांकन करें",
    schemesDocuments: "आवश्यक दस्तावेज़",
    schemesLinkFromFusion: "लागू स्वास्थ्य योजनाएँ देखें →",
    // ── Tele-Consultation Queue ───────────────────────────────────────────────
    consultRequestBtn: "टेली-परामर्श अनुरोध करें",
    consultRequestedSuccess: "टेली-परामर्श अनुरोध सहेजा गया ✓",
    consultQueueTab: "परामर्श कतार",
    triageListTab: "ट्राइज सूची",
    consultShareBtn: "परामर्श सारांश साझा करें",
    consultShareNote: "स्टोर-एंड-फॉरवर्ड परामर्श — डॉक्टर को व्हाट्सएप/एसएमएस या अगली भेंट पर यह सारांश दें।",
    consultStatusRequested: "अनुरोधित",
    consultStatusSent: "डॉक्टर को भेजा गया",
    consultStatusCompleted: "पूर्ण",
    consultMarkSent: "डॉक्टर को भेजा गया चिह्नित करें",
    consultMarkCompleted: "पूर्ण चिह्नित करें",
    consultAddNote: "क्लिनिकल टिप्पणी लिखें…",
    consultNotesLabel: "क्लिनिकल टिप्पणी",
    consultNoRequests: "कतार में कोई लंबित टेली-परामर्श अनुरोध नहीं है।",
    consultCopied: "परामर्श सारांश क्लिपबोर्ड पर कॉपी हो गया!",
    consultPacketTitle: "स्टोर-एंड-फॉरवर्ड टेली-परामर्श पैकेट",
    consultDisclaimer: "स्टोर-एंड-फॉरवर्ड स्क्रीनिंग सारांश। चिकित्सकीय परीक्षण द्वारा पुष्टि करें।",
    // ── Health Awareness & Regional Advisories ────────────────────────────────
    awarenessNav: "स्वास्थ्य ज्ञान",
    awarenessTitle: "ग्रामीण स्वास्थ्य जागरूकता एवं साक्षरता",
    awarenessSubtitle: "ग्रामीण परिवारों के लिए आवश्यक रोकथाम और प्राथमिक देखभाल। सुनें या पढ़ें।",
    awarenessListenBtn: "बोलकर सुनाएँ",
    awarenessStopBtn: "रोकें",
    advisoriesTitle: "क्षेत्रीय जन स्वास्थ्य परामर्श",
    advisoriesBundledNotice: "बंडल किए गए परामर्श — क्लिनिक डिवाइस ऑनलाइन होने पर अद्यतन होते हैं।",
    advisoriesDistrictLabel: "जिला चुनें",
    advisoriesLastUpdated: "अद्यतन",
    advisoriesActionsLabel: "अनुशंसित सावधानियाँ",
    advisoriesSeeFeverLink: "बुखार व मौसमी स्वास्थ्य परामर्श देखें →",
    // ── EMR-Lite & Clinic Backup ──────────────────────────────────────────────
    manualVitalsTitle: "क्लिनिक उपकरणों द्वारा मापा गया",
    manualVitalsDesc: "बीपी कफ, थर्मामीटर या पल्स ऑक्सीमीटर से लिए गए माप यहाँ दर्ज करें।",
    bpSystolicLabel: "सिस्टोलिक (ऊपरी)",
    bpDiastolicLabel: "डायस्टोलिक (निचला)",
    tempLabel: "तापमान (°C)",
    manualSaveBtn: "माप सुरक्षित करें",
    manualVitalsSaved: "माप सहेजे गए ✓",
    sourceCamera: "कैमरा स्कैन",
    sourceManual: "उपकरण (मैन्युअल)",
    timelineTitle: "एकीकृत मरीज़ इतिहास",
    timelineSubtitle: "तिथि अनुसार भेंट विवरण, माप और परामर्श स्थिति।",
    timelineEmpty: "इस मरीज़ के लिए अभी तक कोई रिकॉर्ड नहीं है।",
    backupExportBtn: "क्लिनिक बैकअप डाउनलोड करें",
    backupImportBtn: "बैकअप आयात करें",
    backupImportSuccess: "क्लिनिक बैकअप सफलतापूर्वक बहाल किया गया!",
    backupImportError: "अमान्य बैकअप फ़ाइल।",
    priorityUrgent: "तत्काल (लाल)",
    priorityReview: "समीक्षा (पीला)",
    priorityRoutine: "सामान्य (हरा)",
};

const STRINGS: Record<Locale, Strings> = { en, hi };

export function getStrings(locale: Locale): Strings {
    return STRINGS[locale] ?? STRINGS.en;
}