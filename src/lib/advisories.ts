/**
 * advisories.ts — Static regional public-health advisories.
 *
 * HONESTY RULES:
 * - Bundled static data: clearly labeled "Bundled advisories — updated when the clinic device is online."
 * - Source label on every advisory: "District health advisory — verify locally."
 * - Never fabricate live real-time epidemic telemetry.
 *
 * Offline-first: 100% available offline without network access.
 */

export interface RegionalAdvisory {
  id: string;
  districtId: string;
  districtNameEn: string;
  districtNameHi: string;
  titleEn: string;
  titleHi: string;
  category: "vector" | "maternal" | "child" | "seasonal" | "water";
  summaryEn: string;
  summaryHi: string;
  actionsEn: string[];
  actionsHi: string[];
  sourceLabelEn: string;
  sourceLabelHi: string;
  lastUpdated: string;
}

export const DISTRICTS = [
  { id: "churu", nameEn: "Churu", nameHi: "चूरू" },
  { id: "sikar", nameEn: "Sikar", nameHi: "सीकर" },
  { id: "alwar", nameEn: "Alwar", nameHi: "अलवर" },
  { id: "jhunjhunu", nameEn: "Jhunjhunu", nameHi: "झुंझुनूं" },
  { id: "nagaur", nameEn: "Nagaur", nameHi: "नागौर" },
  { id: "jaipur-rural", nameEn: "Jaipur Rural", nameHi: "जयपुर ग्रामीण" },
] as const;

export const REGIONAL_ADVISORIES: RegionalAdvisory[] = [
  // ── Churu ──────────────────────────────────────────────────────────────────
  {
    id: "adv-chu-1",
    districtId: "churu",
    districtNameEn: "Churu",
    districtNameHi: "चूरू",
    category: "seasonal",
    titleEn: "Extreme Heat & Dehydration Protocol",
    titleHi: "भीषण गर्मी और निर्जलीकरण (लू) रोकथाम निर्देशिका",
    summaryEn: "Day temperatures exceeding 44°C require active hydration and early symptom monitoring for elderly and outdoor workers.",
    summaryHi: "दिन का तापमान 44°C से अधिक होने के कारण बुजुर्गों और खेतों में काम करने वालों के लिए निरंतर जलपान और प्रारंभिक लक्षणों की निगरानी आवश्यक है।",
    actionsEn: [
      "Drink lemon water, buttermilk, or ORS every 2 hours even if not thirsty.",
      "Avoid direct sun exposure between 11:30 AM and 4:00 PM.",
      "If fever with stopped sweating or confusion occurs, seek immediate PHC care.",
    ],
    actionsHi: [
      "प्यास न लगने पर भी हर 2 घंटे में नींबू पानी, छाछ या ओआरएस घोल पिएं।",
      "दोपहर 11:30 से 4:00 बजे तक सीधी धूप में जाने से बचें।",
      "यदि पसीना आना बंद हो जाए, तेज़ बुखार या चक्कर आए तो तुरंत नजदीकी पीएचसी जाएँ।",
    ],
    sourceLabelEn: "District Health Society, Churu — Verify locally",
    sourceLabelHi: "जिला स्वास्थ्य समिति, चूरू — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-08-15",
  },
  {
    id: "adv-chu-2",
    districtId: "churu",
    districtNameEn: "Churu",
    districtNameHi: "चूरू",
    category: "vector",
    titleEn: "Monsoon Dengue & Malaria Screening",
    titleHi: "मानसून पश्चात डेंगू व मलेरिया रोकथाम एवं जाँच",
    summaryEn: "Intermittent post-monsoon rain increases mosquito breeding in household water storage tanks (kunds).",
    summaryHi: "मानसून उपरांत रुक-रुक कर हो रही बारिश से घरों के कुंड और पानी की टंकियों में मच्छर का लार्वा पनपने का जोखिम बढ़ा है।",
    actionsEn: [
      "Keep all water storage kunds and drums tightly covered.",
      "Apply temephos larvicide or clean coolers weekly (Dry Day every Sunday).",
      "Any high fever with body ache warrants blood slide / NS1 card testing at PHC.",
    ],
    actionsHi: [
      "पीने के पानी के सभी कुंड और ड्रमों को जाली या ढक्कन से कसकर ढकें।",
      "प्रत्येक रविवार को 'ड्राई डे' मनाएं और कूलर व जलपात्रों को सुखाकर साफ करें।",
      "तेज़ बुखार, बदन दर्द होने पर पीएचसी पर रक्त स्लाइड या रैपिड कार्ड जाँच कराएँ।",
    ],
    sourceLabelEn: "Chief Medical & Health Office, Churu — Verify locally",
    sourceLabelHi: "मुख्य चिकित्सा एवं स्वास्थ्य अधिकारी, चूरू — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-08-28",
  },

  // ── Sikar ──────────────────────────────────────────────────────────────────
  {
    id: "adv-sik-1",
    districtId: "sikar",
    districtNameEn: "Sikar",
    districtNameHi: "सीकर",
    category: "child",
    titleEn: "Mission Indradhanush Childhood Immunization Catch-up",
    titleHi: "सघन मिशन इंद्रधनुष: छूटे बच्चों का टीकाकरण अभियान",
    summaryEn: "Special camps are operational at all Sub-Centres and Anganwadi centres for zero-dose and drop-out children under 5.",
    summaryHi: "5 वर्ष से कम आयु के जिन बच्चों के टीके छूट गए हैं, उनके लिए उपकेंद्रों और आँगनवाड़ी केंद्रों पर विशेष सत्र आयोजित किए जा रहे हैं।",
    actionsEn: [
      "Bring Mother-Child Protection (MCP) card to the nearest Anganwadi session.",
      "MR (Measles-Rubella) second dose and DPT boosters are available free.",
      "ASHA workers provide transport guidance for hard-to-reach dhanees.",
    ],
    actionsHi: [
      "नजदीकी आँगनवाड़ी सत्र में ममता कार्ड (मातृ एवं शिशु सुरक्षा कार्ड) साथ लाएँ।",
      "खसरा-रूबेला (MR) की दूसरी खुराक और DPT बूस्टर टीके निःशुल्क उपलब्ध हैं।",
      "दूरदराज ढाणियों के लिए आशा सहयोगिनी से संपर्क करें।",
    ],
    sourceLabelEn: "District Immunization Officer, Sikar — Verify locally",
    sourceLabelHi: "जिला टीकाकरण अधिकारी, सीकर — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-09-02",
  },
  {
    id: "adv-sik-2",
    districtId: "sikar",
    districtNameEn: "Sikar",
    districtNameHi: "सीकर",
    category: "maternal",
    titleEn: "PMSMA Antenatal High-Risk Pregnancy Screening",
    titleHi: "प्रधानमंत्री सुरक्षित मातृत्व अभियान: उच्च जोखिम गर्भावस्था जाँच",
    summaryEn: "Free comprehensive check-ups on the 9th of every month at all Community Health Centres (CHCs).",
    summaryHi: "प्रत्येक माह की 9 तारीख को सभी सामुदायिक स्वास्थ्य केंद्रों (सीएचसी) पर गर्भवती महिलाओं की निःशुल्क विशेषज्ञ जाँच।",
    actionsEn: [
      "All pregnant women in 2nd and 3rd trimester should attend the 9th-of-month camp.",
      "Free ultrasound, hemoglobin, and blood sugar tests included.",
      "Identify anemia or high BP early to plan safe institutional delivery.",
    ],
    actionsHi: [
      "दूसरी व तीसरी तिमाही की सभी गर्भवती महिलाएँ 9 तारीख के शिविर में जाँच कराएँ।",
      "निःशुल्क सोनोग्राफी, हीमोग्लोबिन और रक्त शर्करा जाँच की सुविधा।",
      "खून की कमी या रक्तचाप की शीघ्र पहचान कर सुरक्षित अस्पताल प्रसव सुनिश्चित करें।",
    ],
    sourceLabelEn: "NHM District Programme Management Unit, Sikar — Verify locally",
    sourceLabelHi: "एनएचएम जिला कार्यक्रम इकाई, सीकर — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-09-05",
  },

  // ── Alwar ──────────────────────────────────────────────────────────────────
  {
    id: "adv-alw-1",
    districtId: "alwar",
    districtNameEn: "Alwar",
    districtNameHi: "अलवर",
    category: "water",
    titleEn: "Waterborne Gastroenteritis & Diarrhea Advisory",
    titleHi: "दूषित जलजनित उल्टी-दस्त रोकथाम परामर्श",
    summaryEn: "Increased acute diarrheal cases reported in peri-urban blocks following pipeline leaks during heavy rains.",
    summaryHi: "हालिया बारिश के कारण पेयजल लाइनों में रिसाव से कुछ ग्रामीण क्षेत्रों में उल्टी-दस्त के मामले सामने आए हैं।",
    actionsEn: [
      "Boil drinking water for at least 1 minute or use chlorine tablets provided by ASHA.",
      "Start ORS and Zinc dispersion immediately at the first loose stool.",
      "Do not give antimotility pills to young children; refer if blood in stool.",
    ],
    actionsHi: [
      "पीने का पानी कम से कम 1 मिनट तक उबालें या आशा द्वारा दी गई क्लोरीन की गोली डालें।",
      "दस्त शुरू होते ही तुरंत ओआरएस घोल और जिंक की गोली देना शुरू करें।",
      "बच्चों को बिना डॉक्टर की सलाह के दस्त रोकने की दवा न दें; मल में खून आने पर तुरंत अस्पताल ले जाएं।",
    ],
    sourceLabelEn: "District Surveillance Unit, IDSP Alwar — Verify locally",
    sourceLabelHi: "जिला निगरानी इकाई (IDSP), अलवर — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-09-08",
  },
  {
    id: "adv-alw-2",
    districtId: "alwar",
    districtNameEn: "Alwar",
    districtNameHi: "अलवर",
    category: "vector",
    titleEn: "Scrub Typhus & Tick-borne Fever Alert",
    titleHi: "स्क्रब टाइफस एवं कीटजनित बुखार चेतावनी",
    summaryEn: "Field workers cutting cattle fodder in moist shrub areas are at risk of mite bites causing high fever with eschar.",
    summaryHi: "घास-फूस व झाड़ियों में मवेशियों के लिए चारा काटने वालों में पिस्सू के काटने से तेज़ बुखार का खतरा रहता है।",
    actionsEn: [
      "Wear full-sleeved shirts, trousers tucked into socks, and boots in grasslands.",
      "Check skin for small black scab (eschar) behind ears, groin, or axilla.",
      "Doxycycline is available at all PHCs; prompt treatment prevents complications.",
    ],
    actionsHi: [
      "खेतों में काम करते समय पूरी आस्तीन के कपड़े और पैरों में जूते-मोज़े पहनें।",
      "शरीर पर काले पपड़ीदार निशान (एस्कर) की जाँच करें, विशेषकर कान के पीछे या कांख में।",
      "पीएचसी पर डॉक्सीसाइक्लिन दवा उपलब्ध है; समय पर इलाज से जटिलताओं से बचा जा सकता है।",
    ],
    sourceLabelEn: "CMHO Alwar Epidemic Cell — Verify locally",
    sourceLabelHi: "मुख्य चिकित्सा अधिकारी महामारी प्रकोष्ठ, अलवर — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-09-10",
  },

  // ── Jhunjhunu ──────────────────────────────────────────────────────────────
  {
    id: "adv-jhn-1",
    districtId: "jhunjhunu",
    districtNameEn: "Jhunjhunu",
    districtNameHi: "झुंझुनूं",
    category: "seasonal",
    titleEn: "Seasonal Viral URI & Bronchitis in Children",
    titleHi: "ऋतु परिवर्तन: बच्चों में मौसमी खाँसी-जुकाम एवं श्वास संबंधी सावधानी",
    summaryEn: "Fluctuating night temperatures trigger wheezing and respiratory syncytial viral episodes in infants.",
    summaryHi: "रात और दिन के तापमान में अंतर के कारण छोटे बच्चों में पसली चलना और घरघराहट की समस्या बढ़ रही है।",
    actionsEn: [
      "Keep infants warm in early mornings; avoid woodsmoke inside closed rooms.",
      "Count breaths per minute: over 50/min in infants under 1 year is a danger sign.",
      "Ensure continued breastfeeding during fever and cold.",
    ],
    actionsHi: [
      "सुबह-शाम बच्चों को ठंडी हवा से बचाएं; कमरे में लकड़ी या कंडे का धुआँ न होने दें।",
      "बच्चे की साँस की गति गिनें: यदि 1 वर्ष से कम का बच्चा 50 से तेज़ साँस ले तो तुरंत पीएचसी ले जाएँ।",
      "बुखार और जुकाम में भी माँ का दूध निरंतर पिलाते रहें।",
    ],
    sourceLabelEn: "Department of Pediatrics, District Hospital Jhunjhunu — Verify locally",
    sourceLabelHi: "शिशु रोग विभाग, जिला अस्पताल झुंझुनूं — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-09-01",
  },

  // ── Nagaur ─────────────────────────────────────────────────────────────────
  {
    id: "adv-nag-1",
    districtId: "nagaur",
    districtNameEn: "Nagaur",
    districtNameHi: "नागौर",
    category: "water",
    titleEn: "Fluorosis Prevention & Safe Well Water Testing",
    titleHi: "फ्लोरोसिस रोकथाम एवं सुरक्षित भूजल परीक्षण",
    summaryEn: "High fluoride groundwater causes joint stiffness and mottled teeth in children; RO kiosks are operational in 42 gram panchayats.",
    summaryHi: "भूजल में अत्यधिक फ्लोराइड से बच्चों के दांतों और बुजुर्गों के जोड़ों में दर्द की समस्या; सुरक्षित आरओ संयंत्रों का उपयोग करें।",
    actionsEn: [
      "Use village RO water or community canal water supply for drinking and cooking.",
      "Include calcium and vitamin C rich foods (amla, drumsticks, curd) in daily diet.",
      "Get household tubewell tested free through the Public Health Engineering Lab.",
    ],
    actionsHi: [
      "पीने व खाना पकाने में केवल सरकारी आरओ या नहरी जल आपूर्ति का उपयोग करें।",
      "आहार में आंवला, सहजन (ड्रमस्टिक), और दही जैसे कैल्शियम व विटामिन-सी युक्त खाद्य शामिल करें।",
      "अपने निजी नलकूप के पानी की फ्लोराइड जाँच सरकारी प्रयोगशाला से कराएँ।",
    ],
    sourceLabelEn: "PHED & District Health Society, Nagaur — Verify locally",
    sourceLabelHi: "जन स्वास्थ्य अभियांत्रिकी विभाग एवं स्वास्थ्य समिति, नागौर — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-08-20",
  },

  // ── Jaipur Rural ───────────────────────────────────────────────────────────
  {
    id: "adv-jpr-1",
    districtId: "jaipur-rural",
    districtNameEn: "Jaipur Rural",
    districtNameHi: "जयपुर ग्रामीण",
    category: "vector",
    titleEn: "Chikungunya & Joint Pain Management",
    titleHi: "चिकुनगुनिया एवं जोड़ों के दर्द का उचित प्रबंधन",
    summaryEn: "Cluster of viral fevers with severe hand and ankle arthritis reported in rural blocks.",
    summaryHi: "कुछ ग्रामीण ढाणियों में तेज़ बुखार के साथ कलाई व टखनों में असहनीय दर्द के मामले सामने आए हैं।",
    actionsEn: [
      "Use paracetamol for fever and pain; avoid NSAIDs (ibuprofen/aspirin) until dengue is ruled out.",
      "Drink adequate fluids and take complete bed rest for 5–7 days.",
      "Contact ASHA worker for vector fogging in case of neighborhood fever clusters.",
    ],
    actionsHi: [
      "दर्द और बुखार के लिए केवल पैरासिटामोल लें; जब तक डेंगू की जाँच न हो, अन्य दर्द निवारक दवाइयों से बचें।",
      "पर्याप्त मात्रा में तरल पदार्थ लें और 5–7 दिन का पूर्ण विश्राम करें।",
      "आसपास एक से अधिक बुखार के मरीज़ होने पर फॉगिंग के लिए स्वास्थ्य कार्यकर्ता को सूचित करें।",
    ],
    sourceLabelEn: "CMHO Jaipur-II Rural Health Unit — Verify locally",
    sourceLabelHi: "मुख्य चिकित्सा अधिकारी जयपुर-द्वितीय ग्रामीण — स्थानीय स्तर पर पुष्टि करें",
    lastUpdated: "2026-09-07",
  },
];
