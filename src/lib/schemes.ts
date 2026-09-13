/**
 * schemes.ts — Static data for Indian government health schemes.
 *
 * HONESTY RULES enforced by this data:
 * - Never assert eligibility for a specific patient.
 * - Where enrollment details vary by state, we say "Check the official portal".
 * - Every scheme has a verifyFooter injected by the UI.
 * - Portal URLs are the actual official GOI portals, verified at time of writing.
 *
 * Offline-first: this file is bundled — no network request at runtime.
 */

export interface Scheme {
  id: string;
  nameEn: string;
  nameHi: string;
  coverageEn: string;
  coverageHi: string;
  whoForEn: string;
  whoForHi: string;
  enrollEn: string;
  enrollHi: string;
  documentsEn: string;
  documentsHi: string;
  /** Official government portal URL. */
  portalUrl: string;
}

export const SCHEMES: Scheme[] = [
  {
    id: "pm-jay",
    nameEn: "Ayushman Bharat PM-JAY",
    nameHi: "आयुष्मान भारत PM-JAY",
    coverageEn:
      "Cashless hospitalisation up to ₹5 lakh per family per year at empanelled public and private hospitals. Covers surgery, medicines, diagnostics, and post-surgery care for 1,700+ procedures.",
    coverageHi:
      "सूचीबद्ध सरकारी और निजी अस्पतालों में प्रति परिवार प्रति वर्ष ₹5 लाख तक कैशलेस इलाज। 1,700+ प्रक्रियाओं के लिए सर्जरी, दवाइयाँ, जाँच और ऑपरेशन के बाद देखभाल शामिल है।",
    whoForEn:
      "Low-income families identified in the Socio-Economic Caste Census (SECC) 2011. Covers the bottom 40% of rural and urban population — approximately 50 crore beneficiaries. Check eligibility on the official portal.",
    whoForHi:
      "सामाजिक-आर्थिक जाति जनगणना (SECC) 2011 में चिह्नित कम आय वाले परिवार। ग्रामीण और शहरी आबादी के निचले 40% परिवार शामिल — लगभग 50 करोड़ लाभार्थी। पात्रता आधिकारिक पोर्टल पर जाँचें।",
    enrollEn:
      "Visit the nearest Common Service Centre (CSC), Arogya Mitra at an empanelled hospital, or check the Beneficiary Identification System on the official portal with your Aadhaar number.",
    enrollHi:
      "नज़दीकी कॉमन सर्विस सेंटर (CSC), सूचीबद्ध अस्पताल में आरोग्य मित्र से मिलें, या आधार नंबर से आधिकारिक पोर्टल पर लाभार्थी पहचान प्रणाली से जाँचें।",
    documentsEn: "Aadhaar card (or other KYC document). No separate card needed — name verification at hospital is sufficient in most states.",
    documentsHi: "आधार कार्ड (या अन्य KYC दस्तावेज़)। अधिकांश राज्यों में अलग कार्ड की ज़रूरत नहीं — अस्पताल में नाम सत्यापन पर्याप्त है।",
    portalUrl: "https://pmjay.gov.in",
  },
  {
    id: "pm-abhim",
    nameEn: "PM Ayushman Bharat Health Infrastructure Mission (PM-ABHIM)",
    nameHi: "पीएम आयुष्मान भारत स्वास्थ्य अवसंरचना मिशन (PM-ABHIM)",
    coverageEn:
      "Strengthens primary, secondary, and critical care infrastructure in rural and urban areas. Funds new health and wellness centres, block-level public health units, critical care hospital blocks, and disease surveillance networks. Patients benefit indirectly through improved local facilities.",
    coverageHi:
      "ग्रामीण और शहरी क्षेत्रों में प्राथमिक, माध्यमिक और गंभीर देखभाल बुनियादी ढाँचे को मजबूत करता है। नए स्वास्थ्य एवं आरोग्य केंद्र, ब्लॉक-स्तरीय सार्वजनिक स्वास्थ्य इकाइयाँ, गंभीर देखभाल अस्पताल ब्लॉक और रोग निगरानी नेटवर्क के लिए धन देता है।",
    whoForEn:
      "All citizens — this is an infrastructure investment scheme, not a direct beneficiary scheme. The improved facilities serve the entire community.",
    whoForHi:
      "सभी नागरिक — यह बुनियादी ढाँचा निवेश योजना है, सीधा लाभार्थी योजना नहीं। बेहतर सुविधाएँ पूरे समुदाय की सेवा करती हैं।",
    enrollEn: "No individual enrollment needed. Check the official portal for facility locations in your district.",
    enrollHi: "व्यक्तिगत नामांकन की आवश्यकता नहीं। अपने जिले में सुविधाओं की जानकारी के लिए आधिकारिक पोर्टल देखें।",
    documentsEn: "Not applicable for individual enrollment.",
    documentsHi: "व्यक्तिगत नामांकन के लिए लागू नहीं।",
    portalUrl: "https://pib.gov.in/PressReleasePage.aspx?PRID=1764175",
  },
  {
    id: "jan-aushadhi",
    nameEn: "Pradhan Mantri Bharatiya Jan Aushadhi Pariyojana (PMBJP)",
    nameHi: "प्रधानमंत्री भारतीय जन औषधि परियोजना (PMBJP)",
    coverageEn:
      "Generic medicines of standard quality available at Jan Aushadhi Kendras (dedicated stores) at 50–90% lower cost than branded medicines. Over 2,000 medicines and 300 surgical consumables listed. Useful for chronic disease management.",
    coverageHi:
      "जन औषधि केंद्रों (समर्पित दुकानों) पर ब्रांडेड दवाओं से 50–90% कम कीमत पर मानक गुणवत्ता की जेनेरिक दवाइयाँ। 2,000 से अधिक दवाइयाँ और 300 सर्जिकल उपभोज्य सूचीबद्ध हैं।",
    whoForEn: "All citizens. No registration required — anyone can purchase at a Jan Aushadhi Kendra.",
    whoForHi: "सभी नागरिक। पंजीकरण की आवश्यकता नहीं — कोई भी जन औषधि केंद्र से खरीद सकता है।",
    enrollEn: "Find the nearest Jan Aushadhi Kendra on the official portal or call 1800-180-8080 (toll-free). No card or document needed to purchase.",
    enrollHi: "आधिकारिक पोर्टल पर नज़दीकी जन औषधि केंद्र खोजें या 1800-180-8080 (टोल-फ्री) पर कॉल करें। खरीदारी के लिए कोई कार्ड या दस्तावेज़ ज़रूरी नहीं।",
    documentsEn: "No documents required for purchasing medicines.",
    documentsHi: "दवाइयाँ खरीदने के लिए कोई दस्तावेज़ आवश्यक नहीं।",
    portalUrl: "https://janaushadhi.gov.in",
  },
  {
    id: "jsy",
    nameEn: "Janani Suraksha Yojana (JSY)",
    nameHi: "जननी सुरक्षा योजना (JSY)",
    coverageEn:
      "Cash incentive for pregnant women who deliver at government or accredited private health facilities. Amount varies by state and rural/urban classification. Also covers transport and ASHA worker support.",
    coverageHi:
      "सरकारी या मान्यता प्राप्त निजी स्वास्थ्य केंद्र में प्रसव कराने वाली गर्भवती महिलाओं को नकद प्रोत्साहन। राशि राज्य और ग्रामीण/शहरी वर्गीकरण के अनुसार अलग-अलग है। परिवहन और आशा कार्यकर्ता सहायता भी शामिल।",
    whoForEn:
      "Pregnant women, especially from below-poverty-line (BPL) households, SC/ST communities, and low-performing states. All pregnant women in LPS (Low Performing States) are eligible regardless of income. Check the official portal for your state's eligibility criteria.",
    whoForHi:
      "गर्भवती महिलाएँ, विशेषकर गरीबी रेखा से नीचे (BPL) परिवारों, SC/ST समुदायों और कम प्रदर्शन वाले राज्यों से। कम प्रदर्शन वाले राज्यों (LPS) में सभी गर्भवती महिलाएँ आय की परवाह किए बिना पात्र हैं। अपने राज्य की पात्रता के लिए आधिकारिक पोर्टल देखें।",
    enrollEn: "Register at the nearest Anganwadi centre, ASHA worker, or Sub-District Health Centre during early pregnancy. Cash is paid after institutional delivery.",
    enrollHi: "गर्भावस्था की शुरुआत में नज़दीकी आँगनवाड़ी केंद्र, आशा कार्यकर्ता या उप-जिला स्वास्थ्य केंद्र में पंजीकरण कराएँ। नकद संस्थागत प्रसव के बाद दिया जाता है।",
    documentsEn: "BPL card (if applicable), Aadhaar, bank account details for DBT, and ANC (antenatal care) registration card.",
    documentsHi: "BPL कार्ड (यदि लागू हो), आधार, DBT के लिए बैंक खाता विवरण, और ANC (प्रसव पूर्व देखभाल) पंजीकरण कार्ड।",
    portalUrl: "https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=841&lid=309",
  },
  {
    id: "dialysis",
    nameEn: "Pradhan Mantri National Dialysis Programme (PMNDP)",
    nameHi: "प्रधानमंत्री राष्ट्रीय डायलिसिस कार्यक्रम (PMNDP)",
    coverageEn:
      "Free dialysis services for Below Poverty Line (BPL) patients with chronic kidney disease at district-level government hospitals. Covers up to 3 sessions per week. Other patients receive dialysis at subsidised rates.",
    coverageHi:
      "जिला-स्तरीय सरकारी अस्पतालों में गरीबी रेखा से नीचे (BPL) के दीर्घकालिक गुर्दा रोग के मरीज़ों के लिए मुफ़्त डायलिसिस सेवाएँ। प्रति सप्ताह 3 सत्रों तक। अन्य मरीज़ों को रियायती दर पर डायलिसिस मिलती है।",
    whoForEn:
      "Patients with chronic kidney disease who require regular dialysis. BPL patients receive free services; above-BPL patients receive subsidised rates. Availability varies by district — check the official portal.",
    whoForHi:
      "दीर्घकालिक गुर्दा रोग के मरीज़ जिन्हें नियमित डायलिसिस की ज़रूरत है। BPL मरीज़ों को मुफ़्त सेवाएँ; BPL से ऊपर के मरीज़ों को रियायती दर। उपलब्धता जिले के अनुसार भिन्न — आधिकारिक पोर्टल देखें।",
    enrollEn: "Check the official portal or contact the nearest district hospital's nephrology / dialysis unit. BPL card or income certificate typically required.",
    enrollHi: "आधिकारिक पोर्टल देखें या नज़दीकी जिला अस्पताल की नेफ्रोलॉजी/डायलिसिस इकाई से संपर्क करें। BPL कार्ड या आय प्रमाण पत्र सामान्यतः आवश्यक है।",
    documentsEn: "BPL card or income certificate, Aadhaar card, referral from a government doctor, and kidney disease diagnosis report.",
    documentsHi: "BPL कार्ड या आय प्रमाण पत्र, आधार कार्ड, सरकारी डॉक्टर का रेफरल और गुर्दा रोग निदान रिपोर्ट।",
    portalUrl: "https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=1126&lid=609",
  },
  {
    id: "rbsk",
    nameEn: "Rashtriya Bal Swasthya Karyakram (RBSK)",
    nameHi: "राष्ट्रीय बाल स्वास्थ्य कार्यक्रम (RBSK)",
    coverageEn:
      "Free health screening and early intervention for children aged 0–18 years for 4 Ds: Defects at birth, Deficiencies, Diseases, and Developmental delays. Covers referral to District Early Intervention Centres (DEICs) for free treatment up to ₹1 lakh per child.",
    coverageHi:
      "0–18 वर्ष के बच्चों के लिए 4D की मुफ़्त स्वास्थ्य जाँच और शीघ्र हस्तक्षेप: जन्म दोष, कमियाँ, रोग और विकास संबंधी विलंब। प्रति बच्चे ₹1 लाख तक के मुफ़्त इलाज के लिए जिला प्रारंभिक हस्तक्षेप केंद्रों (DEICs) में रेफरल शामिल।",
    whoForEn:
      "All children aged 0–18 years, especially those in government schools and Anganwadi centres. Mobile health teams visit schools and community centres.",
    whoForHi:
      "0–18 वर्ष के सभी बच्चे, विशेषकर सरकारी स्कूलों और आँगनवाड़ी केंद्रों में। मोबाइल स्वास्थ्य टीमें स्कूलों और सामुदायिक केंद्रों में जाती हैं।",
    enrollEn: "No active enrollment needed for school screening. For DEIC referral services, contact your nearest government hospital or ASHA worker with the child's birth certificate and Aadhaar.",
    enrollHi: "स्कूल जाँच के लिए सक्रिय नामांकन ज़रूरी नहीं। DEIC रेफरल सेवाओं के लिए, बच्चे के जन्म प्रमाण पत्र और आधार के साथ नज़दीकी सरकारी अस्पताल या आशा कार्यकर्ता से संपर्क करें।",
    documentsEn: "Child's birth certificate, Aadhaar (or enrollment in Aadhaar for children), school ID (if enrolled). Screening at school is free and no documents are needed.",
    documentsHi: "बच्चे का जन्म प्रमाण पत्र, आधार (या बच्चों के लिए आधार नामांकन), स्कूल ID (यदि नामांकित हो)। स्कूल में जाँच मुफ़्त है और कोई दस्तावेज़ ज़रूरी नहीं।",
    portalUrl: "https://rbsk.nhm.gov.in",
  },
];
