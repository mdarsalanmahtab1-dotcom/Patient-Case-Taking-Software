export type Language = 'en' | 'hi' | 'bn';

export interface Translations {
  common: {
    appName: string;
    loading: string;
    error: string;
    back: string;
    close: string;
  };
  tabs: {
    home: string;
    history: string;
    hospital: string;
    profile: string;
  };
  home: {
    goodMorning: string;
    goodAfternoon: string;
    goodEvening: string;
    patient: string;
    queueTitle: string;
    liveToken: string;
    positionAhead: string;
    estimatedWait: string;
    minutes: string;
    room: string;
    noActiveQueue: string;
    noActiveQueueDesc: string;
    quickActions: string;
    askAi: string;
    askAiDesc: string;
    healthVault: string;
    healthVaultDesc: string;
    hospitalGuide: string;
    hospitalGuideDesc: string;
    recentConsultation: string;
    viewAllHistory: string;
    viewDetails: string;
  };
  history: {
    title: string;
    searchPlaceholder: string;
    noRecords: string;
    noRecordsDesc: string;
    summary: string;
    criticalHighlights: string;
    doctorsNotes: string;
    downloadPdf: string;
    giveFeedback: string;
    feedbackTitle: string;
    ratingPrompt: string;
    commentPlaceholder: string;
    submitting: string;
    submitFeedback: string;
    cancel: string;
    feedbackSuccess: string;
  };
  hospital: {
    title: string;
    subtitle: string;
    activePatientsToday: string;
    departmentsTitle: string;
    doctorsAvailable: string;
    emergencyTitle: string;
    emergencyDesc: string;
    emergencyNumber: string;
  };
  profile: {
    title: string;
    patientDetails: string;
    phone: string;
    abhaId: string;
    notLinked: string;
    languageTitle: string;
    selectLanguage: string;
    exportTitle: string;
    exportDesc: string;
    exportButton: string;
    exporting: string;
    privacyTitle: string;
    privacyDesc: string;
    logout: string;
  };
  chat: {
    title: string;
    subtitle: string;
    statusConnected: string;
    statusGeneral: string;
    welcomeMessage: string;
    inputPlaceholder: string;
    assistantTyping: string;
    disclaimer: string;
    sugMedications: string;
    sugNextDose: string;
    sugDiagnosis: string;
    sugKiosk: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      appName: 'SwasthyaSync',
      loading: 'Loading...',
      error: 'Something went wrong. Please try again.',
      back: 'Back',
      close: 'Close',
    },
    tabs: {
      home: 'Home',
      history: 'History',
      hospital: 'Hospital',
      profile: 'Profile',
    },
    home: {
      goodMorning: 'Good Morning',
      goodAfternoon: 'Good Afternoon',
      goodEvening: 'Good Evening',
      patient: 'Patient',
      queueTitle: 'Live OPD Queue Status',
      liveToken: 'Token',
      positionAhead: 'In Line',
      estimatedWait: 'Est. Wait',
      minutes: 'mins',
      room: 'Room',
      noActiveQueue: 'No Active Consultation',
      noActiveQueueDesc: 'You do not have any pending queue tokens today.',
      quickActions: 'Quick Actions',
      askAi: 'AI Assistant',
      askAiDesc: 'Prescription Q&A',
      healthVault: 'Health Vault',
      healthVaultDesc: 'Export Records',
      hospitalGuide: 'Hospital Info',
      hospitalGuideDesc: 'Doctors & Depts',
      recentConsultation: 'Recent Visit',
      viewAllHistory: 'View All History',
      viewDetails: 'View Details',
    },
    history: {
      title: 'Consultation History',
      searchPlaceholder: 'Search by doctor or department...',
      noRecords: 'No Past Records Found',
      noRecordsDesc: 'Your completed hospital consultations will appear here.',
      summary: 'Clinical Summary',
      criticalHighlights: 'Critical Highlights',
      doctorsNotes: "Doctor's Advice",
      downloadPdf: 'Download Prescription PDF',
      giveFeedback: 'Give Feedback',
      feedbackTitle: 'Rate Your Visit',
      ratingPrompt: 'How was your consultation experience?',
      commentPlaceholder: 'Share any comments or feedback (optional)...',
      submitting: 'Saving...',
      submitFeedback: 'Submit Review',
      cancel: 'Cancel',
      feedbackSuccess: 'Thank you for your valuable feedback!',
    },
    hospital: {
      title: 'Hospital Directory',
      subtitle: 'SwasthyaSync Smart Medical Center',
      activePatientsToday: 'Patients Served Today',
      departmentsTitle: 'Clinical Departments',
      doctorsAvailable: 'Doctors on Duty',
      emergencyTitle: '24/7 Emergency Care',
      emergencyDesc: 'For acute emergencies, trauma, or ambulance assistance:',
      emergencyNumber: '108 / 102 (National Helpline)',
    },
    profile: {
      title: 'Patient Profile',
      patientDetails: 'Identity & Registration',
      phone: 'Registered Mobile',
      abhaId: 'ABHA ID',
      notLinked: 'Not Linked',
      languageTitle: 'Language / भाषा / ভাষা',
      selectLanguage: 'Choose your preferred language',
      exportTitle: 'ABDM Health Vault Export',
      exportDesc: 'Download your entire encrypted consultation bundle as a single portable JSON record.',
      exportButton: 'Download Full Health Record',
      exporting: 'Preparing Bundle...',
      privacyTitle: 'Privacy & Security',
      privacyDesc: 'Your data is secured by ABDM-compliant token authentication with 5-minute OTP lifecycle.',
      logout: 'Log Out of Portal',
    },
    chat: {
      title: 'SwasthyaSync AI',
      subtitle: 'Online • Health & Medical Assistant',
      statusConnected: 'Online • Record Connected',
      statusGeneral: 'Online • Health & Hospital Assistant',
      welcomeMessage: "Hello! I'm SwasthyaSync AI. I can help you understand your medical records, explain lab reports and prescriptions, answer hospital and kiosk questions, or guide you on general health. How can I help you today?",
      inputPlaceholder: 'Ask about reports, medicines, hospital services, or health...',
      assistantTyping: 'SwasthyaSync AI is thinking...',
      disclaimer: 'AI is an educational assistant and not a doctor. In an emergency, please call 108 or consult your clinician immediately.',
      sugMedications: 'What medications am I prescribed?',
      sugNextDose: 'When should I take my medicines?',
      sugDiagnosis: 'Explain my latest report or visit',
      sugKiosk: 'What does the SwasthyaSync kiosk do?',
    },
  },

  hi: {
    common: {
      appName: 'स्वास्थ्यसिंक',
      loading: 'लोड हो रहा है...',
      error: 'कुछ गलत हो गया। कृपया पुन: प्रयास करें।',
      back: 'वापस',
      close: 'बंद करें',
    },
    tabs: {
      home: 'होम',
      history: 'इतिहास',
      hospital: 'अस्पताल',
      profile: 'प्रोफ़ाइल',
    },
    home: {
      goodMorning: 'सुप्रभात',
      goodAfternoon: 'शुभ दोपहर',
      goodEvening: 'शुभ संध्या',
      patient: 'मरीज़',
      queueTitle: 'लाइव ओपीडी कतार की स्थिति',
      liveToken: 'टोकन',
      positionAhead: 'कतार संख्या',
      estimatedWait: 'अनुमानित समय',
      minutes: 'मिनट',
      room: 'कमरा',
      noActiveQueue: 'कोई सक्रिय परामर्श नहीं',
      noActiveQueueDesc: 'आज आपके पास कोई लंबित कतार टोकन नहीं है।',
      quickActions: 'त्वरित कार्य',
      askAi: 'एआई सहायक',
      askAiDesc: 'दवा व सलाह पूछें',
      healthVault: 'हेल्थ वॉल्ट',
      healthVaultDesc: 'रिकॉर्ड डाउनलोड करें',
      hospitalGuide: 'अस्पताल जानकारी',
      hospitalGuideDesc: 'डॉक्टर और विभाग',
      recentConsultation: 'हालिया परामर्श',
      viewAllHistory: 'सभी इतिहास देखें',
      viewDetails: 'विवरण देखें',
    },
    history: {
      title: 'परामर्श इतिहास',
      searchPlaceholder: 'डॉक्टर या विभाग द्वारा खोजें...',
      noRecords: 'कोई पुराना रिकॉर्ड नहीं मिला',
      noRecordsDesc: 'आपके पूर्ण किए गए परामर्श यहां दिखाई देंगे।',
      summary: 'चिकित्सीय सारांश',
      criticalHighlights: 'महत्वपूर्ण बिंदु',
      doctorsNotes: 'डॉक्टर की सलाह',
      downloadPdf: 'पर्चा डाउनलोड करें (PDF)',
      giveFeedback: 'फीडबैक दें',
      feedbackTitle: 'परामर्श का मूल्यांकन करें',
      ratingPrompt: 'आपका अनुभव कैसा रहा?',
      commentPlaceholder: 'कोई टिप्पणी या सुझाव लिखें (वैकल्पिक)...',
      submitting: 'सहेजा जा रहा है...',
      submitFeedback: 'समीक्षा जमा करें',
      cancel: 'रद्द करें',
      feedbackSuccess: 'आपकी बहुमूल्य प्रतिक्रिया के लिए धन्यवाद!',
    },
    hospital: {
      title: 'अस्पताल निर्देशिका',
      subtitle: 'स्वास्थ्यसिंक स्मार्ट मेडिकल सेंटर',
      activePatientsToday: 'आज देखे गए मरीज़',
      departmentsTitle: 'चिकित्सा विभाग',
      doctorsAvailable: 'उपलब्ध डॉक्टर',
      emergencyTitle: '24/7 आपातकालीन सेवा',
      emergencyDesc: 'आपातकालीन सहायता अथवा एम्बुलेंस के लिए:',
      emergencyNumber: '108 / 102 (राष्ट्रीय हेल्पलाइन)',
    },
    profile: {
      title: 'मरीज़ प्रोफ़ाइल',
      patientDetails: 'पहचान एवं पंजीकरण',
      phone: 'पंजीकृत मोबाइल',
      abhaId: 'आभा (ABHA) आईडी',
      notLinked: 'लिंक नहीं है',
      languageTitle: 'Language / भाषा / ভাষা',
      selectLanguage: 'अपनी पसंदीदा भाषा चुनें',
      exportTitle: 'ABDM हेल्थ वॉल्ट एक्सपोर्ट',
      exportDesc: 'अपने सभी मेडिकल रिकॉर्ड को एक सुरक्षित JSON फ़ाइल के रूप में डाउनलोड करें।',
      exportButton: 'सम्पूर्ण स्वास्थ्य रिकॉर्ड डाउनलोड करें',
      exporting: 'फ़ाइल तैयार हो रही है...',
      privacyTitle: 'गोपनीयता एवं सुरक्षा',
      privacyDesc: 'आपका डेटा 5-मिनट OTP एवं सुरक्षित टोकन प्रमाणीकरण द्वारा पूर्णतः सुरक्षित है।',
      logout: 'लॉग आउट करें',
    },
    chat: {
      title: 'स्वास्थ्यसिंक एआई',
      subtitle: 'ऑनलाइन • स्वास्थ्य एवं चिकित्सा सहायक',
      statusConnected: 'ऑनलाइन • रिकॉर्ड उपलब्ध',
      statusGeneral: 'ऑनलाइन • अस्पताल एवं स्वास्थ्य सहायक',
      welcomeMessage: 'नमस्ते! मैं स्वास्थ्यसिंक एआई हूँ। मैं आपके मेडिकल रिकॉर्ड, जांच रिपोर्ट और दवाइयों को समझने, अस्पताल और कियोस्क की जानकारी देने, या सामान्य स्वास्थ्य मार्गदर्शन में आपकी मदद कर सकता हूँ। आज मैं आपकी क्या सहायता करूँ?',
      inputPlaceholder: 'दवा, रिपोर्ट, अस्पताल सेवा या स्वास्थ्य के बारे में पूछें...',
      assistantTyping: 'स्वास्थ्यसिंक एआई विचार कर रहा है...',
      disclaimer: 'एआई एक सहायक है और डॉक्टर का विकल्प नहीं है। आपातकाल में तुरंत 108 पर संपर्क करें या डॉक्टर से मिलें।',
      sugMedications: 'मुझे कौन सी दवाएं दी गई हैं?',
      sugNextDose: 'मुझे दवा किस समय लेनी चाहिए?',
      sugDiagnosis: 'मेरी पिछली रिपोर्ट या सलाह समझाएं',
      sugKiosk: 'स्वास्थ्यसिंक कियोस्क कैसे काम करता है?',
    },
  },

  bn: {
    common: {
      appName: 'স্বাস্থ্যসিঙ্ক',
      loading: 'লোড হচ্ছে...',
      error: 'কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      back: 'পেছনে',
      close: 'বন্ধ করুন',
    },
    tabs: {
      home: 'হোম',
      history: 'ইতিহাস',
      hospital: 'হাসপাতাল',
      profile: 'প্রোফাইল',
    },
    home: {
      goodMorning: 'সুপ্রভাত',
      goodAfternoon: 'শুভ অপরাহ্ন',
      goodEvening: 'শুভ সন্ধ্যা',
      patient: 'রোগী',
      queueTitle: 'লাইভ ওপিডি লাইনের অবস্থা',
      liveToken: 'টোকেন',
      positionAhead: 'লাইনের ক্রম',
      estimatedWait: 'সম্ভাব্য অপেক্ষা',
      minutes: 'মিনিট',
      room: 'রুম',
      noActiveQueue: 'কোন সক্রিয় পরামর্শ নেই',
      noActiveQueueDesc: 'আজকে আপনার কোনো অপেক্ষমাণ টোকেন নেই।',
      quickActions: 'দ্রুত সেবা',
      askAi: 'এআই সহকারী',
      askAiDesc: 'প্রেসক্রিপশন প্রশ্নোত্তর',
      healthVault: 'হেলথ ভল্ট',
      healthVaultDesc: 'রেকর্ড ডাউনলোড',
      hospitalGuide: 'হাসপাতাল তথ্য',
      hospitalGuideDesc: 'ডাক্তার ও বিভাগ',
      recentConsultation: 'সাম্প্রতিক ভিজিট',
      viewAllHistory: 'সব ইতিহাস দেখুন',
      viewDetails: 'বিস্তারিত দেখুন',
    },
    history: {
      title: 'পরামর্শের ইতিহাস',
      searchPlaceholder: 'ডাক্তার বা বিভাগ দিয়ে খুঁজুন...',
      noRecords: 'কোন অতীত রেকর্ড পাওয়া যায়নি',
      noRecordsDesc: 'আপনার সম্পন্ন হওয়া পরামর্শগুলো এখানে থাকবে।',
      summary: 'চিকিৎসা সারসংক্ষেপ',
      criticalHighlights: 'গুরুত্বপূর্ণ সতর্কবার্তা',
      doctorsNotes: 'ডাক্তারের পরামর্শ',
      downloadPdf: 'প্রেসক্রিপশন ডাউনলোড করুন (PDF)',
      giveFeedback: 'মতামত জানান',
      feedbackTitle: 'ভিজিটের মূল্যায়ন করুন',
      ratingPrompt: 'আপনার অভিজ্ঞতা কেমন ছিল?',
      commentPlaceholder: 'আপনার মন্তব্য লিখুন (ঐচ্ছিক)...',
      submitting: 'সংরক্ষণ করা হচ্ছে...',
      submitFeedback: 'মতামত জমা দিন',
      cancel: 'বাতিল',
      feedbackSuccess: 'আপনার মূল্যবান মতামতের জন্য ধন্যবাদ!',
    },
    hospital: {
      title: 'হাসপাতাল ডিরেক্টরি',
      subtitle: 'স্বাস্থ্যসিঙ্ক স্মার্ট মেডিক্যাল সেন্টার',
      activePatientsToday: 'আজ সেবা পাওয়া রোগী',
      departmentsTitle: 'চিকিৎসা বিভাগসমূহ',
      doctorsAvailable: 'উপস্থিত ডাক্তার',
      emergencyTitle: '২৪/৭ জরুরি সেবা',
      emergencyDesc: 'জরুরি অ্যাম্বুলেন্স ও চিকিৎসার জন্য:',
      emergencyNumber: '১০৮ / ১০২ (জাতীয় হেল্পলাইন)',
    },
    profile: {
      title: 'রোগীর প্রোফাইল',
      patientDetails: 'পরিচিতি ও নিবন্ধন',
      phone: 'নিবন্ধিত মোবাইল',
      abhaId: 'আভা (ABHA) আইডি',
      notLinked: 'যুক্ত নেই',
      languageTitle: 'Language / भाषा / ভাষা',
      selectLanguage: 'আপনার পছন্দের ভাষা নির্বাচন করুন',
      exportTitle: 'ABDM হেলথ ভল্ট এক্সপোর্ট',
      exportDesc: 'আপনার সমস্ত প্রেসক্রিপশন এবং চিকিৎসা তথ্য একটি নিরাপদ ফাইলে ডাউনলোড করুন।',
      exportButton: 'সম্পূর্ণ স্বাস্থ্য রেকর্ড ডাউনলোড করুন',
      exporting: 'ফাইল তৈরি হচ্ছে...',
      privacyTitle: 'গোপনীয়তা ও নিরাপত্তা',
      privacyDesc: 'আপনার তথ্য ৫ মিনিটের ওটিপি এবং নিরাপদ টোকেন দ্বারা সম্পূর্ণ সুরক্ষিত।',
      logout: 'লগ আউট করুন',
    },
    chat: {
      title: 'স্বাস্থ্যসিঙ্ক এআই',
      subtitle: 'অনলাইন • স্বাস্থ্য ও চিকিৎসা সহকারী',
      statusConnected: 'অনলাইন • রেকর্ড যুক্ত রয়েছে',
      statusGeneral: 'অনলাইন • হাসপাতাল ও স্বাস্থ্য সহকারী',
      welcomeMessage: 'নমস্কার! আমি স্বাস্থ্যসিঙ্ক এআই। আমি আপনার প্রেসক্রিপশন ও ল্যাব রিপোর্ট বুঝতে, হাসপাতালের তথ্য পেতে এবং সাধারণ স্বাস্থ্য বিষয়ে সাহায্য করতে পারি। আজ আপনাকে কীভাবে সাহায্য করতে পারি?',
      inputPlaceholder: 'ওষুধ, রিপোর্ট বা হাসপাতালের তথ্য জানতে লিখুন...',
      assistantTyping: 'স্বাস্থ্যসিঙ্ক এআই বিশ্লেষণ করছে...',
      disclaimer: 'এআই কোনো চিকিৎসকের বিকল্প নয়। জরুরি পরিস্থিতিতে অবিলম্বে ১০৮ নম্বরে যোগাযোগ করুন।',
      sugMedications: 'আমার কি কি ওষুধ প্রেসক্রাইব করা হয়েছে?',
      sugNextDose: 'ওষুধগুলো কখন কীভাবে খাব?',
      sugDiagnosis: 'আমার সাম্প্রতিক রিপোর্টটি সহজ ভাষায় বুঝিয়ে দিন',
      sugKiosk: 'স্বাস্থ্যসিঙ্ক কিয়স্ক কীভাবে কাজ করে?',
    },
  },
};
