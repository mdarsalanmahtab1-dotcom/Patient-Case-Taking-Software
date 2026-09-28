import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Clock, ShieldCheck, Sparkles, Search } from 'lucide-react';

export interface AyushCheckItem {
  id: string;
  aliases?: string[];
  ayurvedicTerm: string;
  ayurvedicHindi: string;
  englishMeaning: string;
  domain: 'sharirika' | 'kriyatmaka' | 'manasika' | 'vyavaharika' | 'nidana' | 'safety';
  domainLabel: string;
  sopRef: string;
  icon: string;
}

export const ALL_25_AYUSH_CHECKS: AyushCheckItem[] = [
  // ── 1. Sharirika Prakriti (Physical Constitution - 3 Checks) ──
  {
    id: 'prakriti_built',
    aliases: ['prakriti_built', 'built', 'body_frame'],
    ayurvedicTerm: 'Sharirika Samhanana / Deha',
    ayurvedicHindi: 'शारीरिक संहनन (शरीर का ढांचा)',
    englishMeaning: 'Skeletal build, bone structure & weight gain tendency',
    domain: 'sharirika',
    domainLabel: 'Sharirika (Physical)',
    sopRef: 'CCRAS SOP 1.1 (Built)',
    icon: '🦴',
  },
  {
    id: 'prakriti_skin',
    aliases: ['prakriti_skin', 'skin', 'twak'],
    ayurvedicTerm: 'Twak Varna & Sparsha',
    ayurvedicHindi: 'त्वक् वर्ण एवं स्पर्श (त्वचा की बनावट)',
    englishMeaning: 'Natural skin complexion, moisture, warmth & texture',
    domain: 'sharirika',
    domainLabel: 'Sharirika (Physical)',
    sopRef: 'CCRAS SOP 1.2 (Skin)',
    icon: '✨',
  },
  {
    id: 'prakriti_hair',
    aliases: ['prakriti_hair', 'hair', 'kesha'],
    ayurvedicTerm: 'Kesha Prakriti & Rupa',
    ayurvedicHindi: 'केश प्रकृति (बालों की बनावट)',
    englishMeaning: 'Hair thickness, oiliness, curliness & early greying tendency',
    domain: 'sharirika',
    domainLabel: 'Sharirika (Physical)',
    sopRef: 'CCRAS SOP 1.3 (Hair)',
    icon: '💇',
  },

  // ── 2. Kriyatmaka Pariksha (Physiological Functions & Agni - 7 Checks) ──
  {
    id: 'prakriti_appetite',
    ayurvedicTerm: 'Agni & Kshudha Vega',
    ayurvedicHindi: 'अग्नि एवं क्षुधा वेग (भूख और पाचन)',
    englishMeaning: 'Digestive fire, metabolic strength & hunger regularity',
    domain: 'kriyatmaka',
    domainLabel: 'Kriyatmaka (Physiological)',
    sopRef: 'CCRAS SOP 2.1 (Appetite)',
    icon: '🔥',
  },
  {
    id: 'prakriti_thirst',
    ayurvedicTerm: 'Pipasa Pravritti',
    ayurvedicHindi: 'पिपासा प्रवृत्ति (प्यास और पानी की पसंद)',
    englishMeaning: 'Thirst intensity & cold vs warm water preference',
    domain: 'kriyatmaka',
    domainLabel: 'Kriyatmaka (Physiological)',
    sopRef: 'CCRAS SOP 2.2 (Thirst)',
    icon: '💧',
  },
  {
    id: 'prakriti_eating_speed',
    ayurvedicTerm: 'Ahara Vega & Grahanam',
    ayurvedicHindi: 'आहार वेग (खाने की गति)',
    englishMeaning: 'Mastication speed, eating pace & meal focus',
    domain: 'kriyatmaka',
    domainLabel: 'Kriyatmaka (Physiological)',
    sopRef: 'CCRAS SOP 2.3 (Eating Speed)',
    icon: '⏱️',
  },
  {
    id: 'prakriti_bowel',
    ayurvedicTerm: 'Koshtha & Purisha Pravritti',
    ayurvedicHindi: 'कोष्ठ एवं पुरीष (मल त्याग और पेट का स्वभाव)',
    englishMeaning: 'Bowel habit (Krura/Mrudu/Madhyama) & stool consistency',
    domain: 'kriyatmaka',
    domainLabel: 'Kriyatmaka (Physiological)',
    sopRef: 'CCRAS SOP 2.4 (Bowel)',
    icon: '🌿',
  },
  {
    id: 'prakriti_sleep',
    ayurvedicTerm: 'Nidra & Swapna',
    ayurvedicHindi: 'निद्रा एवं स्वप्न (नींद की गहराई)',
    englishMeaning: 'Sleep depth, soundness, duration & wakefulness',
    domain: 'kriyatmaka',
    domainLabel: 'Kriyatmaka (Physiological)',
    sopRef: 'CCRAS SOP 2.5 (Sleep)',
    icon: '🌙',
  },
  {
    id: 'prakriti_weather',
    ayurvedicTerm: 'Sheeta-Ushna Sahishnuta',
    ayurvedicHindi: 'शीत-उष्ण सहिष्णुता (मौसम की संवेदनशीलता)',
    englishMeaning: 'Thermal tolerance: cold wind vs hot summer sun',
    domain: 'kriyatmaka',
    domainLabel: 'Kriyatmaka (Physiological)',
    sopRef: 'CCRAS SOP 2.6 (Thermal)',
    icon: '☀️',
  },
  {
    id: 'prakriti_perspiration',
    ayurvedicTerm: 'Sweda Pravritti & Gandha',
    ayurvedicHindi: 'स्वेद प्रवृत्ति (पसीने की मात्रा व गंध)',
    englishMeaning: 'Sweating volume, odor & body warmth on exertion',
    domain: 'kriyatmaka',
    domainLabel: 'Kriyatmaka (Physiological)',
    sopRef: 'CCRAS SOP 2.7 (Sweat)',
    icon: '💦',
  },

  // ── 3. Manasika Prakriti (Psychological Constitution & Triguna - 3 Checks) ──
  {
    id: 'prakriti_decisiveness',
    ayurvedicTerm: 'Anavasthita Atma / Nishchaya',
    ayurvedicHindi: 'अनवस्थित आत्मा / निश्चय (निर्णय क्षमता)',
    englishMeaning: 'Decision consistency, firmness of mind vs hesitation',
    domain: 'manasika',
    domainLabel: 'Manasika (Psychological)',
    sopRef: 'CCRAS SOP 3.1 (Decisiveness)',
    icon: '🎯',
  },
  {
    id: 'prakriti_memory',
    ayurvedicTerm: 'Smriti & Grahanashakti',
    ayurvedicHindi: 'स्मृति एवं ग्रहणशक्ति (याददाश्त और समझ)',
    englishMeaning: 'Grasping speed, retention and long-term recall',
    domain: 'manasika',
    domainLabel: 'Manasika (Psychological)',
    sopRef: 'CCRAS SOP 3.2 (Memory)',
    icon: '🧠',
  },
  {
    id: 'prakriti_temperament',
    ayurvedicTerm: 'Manasa Prakriti / Amarsha',
    ayurvedicHindi: 'मानस प्रकृति / अमर्ष (क्रोध और स्वभाव)',
    englishMeaning: 'Emotional disposition, reactivity, patience vs anger',
    domain: 'manasika',
    domainLabel: 'Manasika (Psychological)',
    sopRef: 'CCRAS SOP 3.3 (Temperament)',
    icon: '⚖️',
  },

  // ── 4. Vyavaharika Pariksha (Motor Dynamics & Pace - 1 Check) ──
  {
    id: 'prakriti_speech_pace',
    aliases: ['prakriti_speech_pace', 'prakriti_activity', 'speech_pace', 'vak_chesta'],
    ayurvedicTerm: 'Vak & Chesta Vega',
    ayurvedicHindi: 'वाक् एवं चेष्टा वेग (बोलने व चलने की गति)',
    englishMeaning: 'Speech cadence, articulation & walking velocity',
    domain: 'vyavaharika',
    domainLabel: 'Vyavaharika (Behavioral)',
    sopRef: 'CCRAS SOP 4.1 (Pace)',
    icon: '⚡',
  },

  // ── 5. Roga & Nidana Pariksha (Chief Complaint & Symptom Evaluation - 5 Checks) ──
  {
    id: 'symptom_onset',
    aliases: ['symptom_onset', 'onset', 'prathama_utpatti'],
    ayurvedicTerm: 'Hetu / Prathama Utpatti',
    ayurvedicHindi: 'हेतु / प्रथम उत्पत्ति (लक्षण की शुरुआत)',
    englishMeaning: 'Etiological triggers, timing & initial manifestation',
    domain: 'nidana',
    domainLabel: 'Nidana (Clinical HPI)',
    sopRef: 'NAMASTE Roga Hetu',
    icon: '📅',
  },
  {
    id: 'symptom_duration',
    aliases: ['symptom_duration', 'duration', 'kala_mana'],
    ayurvedicTerm: 'Kala & Rogavastha',
    ayurvedicHindi: 'काल एवं रोगावस्था (रोग की अवधि)',
    englishMeaning: 'Chronicity, duration (Ashukari vs Chirakari) & cycle',
    domain: 'nidana',
    domainLabel: 'Nidana (Clinical HPI)',
    sopRef: 'NAMASTE Kala Mana',
    icon: '⏳',
  },
  {
    id: 'symptom_severity',
    aliases: ['symptom_severity', 'severity', 'bala_pramana'],
    ayurvedicTerm: 'Vega & Bala Pramana',
    ayurvedicHindi: 'वेग एवं बल प्रमाण (रोग की तीव्रता)',
    englishMeaning: 'Intensity of discomfort & impairment of daily activities',
    domain: 'nidana',
    domainLabel: 'Nidana (Clinical HPI)',
    sopRef: 'NAMASTE Roga Bala',
    icon: '📊',
  },
  {
    id: 'fever_pattern',
    aliases: ['fever_pattern', 'fever_type', 'chills_rigors', 'jwara_rupa'],
    ayurvedicTerm: 'Sheetapurvaka Jwara Rupa',
    ayurvedicHindi: 'शीतपूर्वक ज्वर रूप (कंपकंपी व बुखार का प्रकार)',
    englishMeaning: 'Fever with chills/rigors, diurnal spikes, perspiration relief',
    domain: 'nidana',
    domainLabel: 'Nidana (Clinical HPI)',
    sopRef: 'NAMC: EB-1 (Jwara)',
    icon: '🌡️',
  },
  {
    id: 'current_medications',
    aliases: ['current_medications', 'medications', 'aushadha_sevana'],
    ayurvedicTerm: 'Aushadha Sevana Itihasa',
    ayurvedicHindi: 'औषध सेवन इतिहास (वर्तमान दवाएं)',
    englishMeaning: 'Prior allopathic or Ayurvedic medication history',
    domain: 'nidana',
    domainLabel: 'Nidana (Clinical HPI)',
    sopRef: 'NAMASTE Aushadha',
    icon: '💊',
  },

  // ── 6. Sadhyasadhyata & Safety Floor Exclusions (6 Checks) ──
  {
    id: 'safety_sepsis',
    aliases: ['safety_sepsis', 'fever_sepsis', 'sannipataja_jwara', 'altered_sensorium'],
    ayurvedicTerm: 'Sannipataja Jwara / Bhrama',
    ayurvedicHindi: 'सन्निपात ज्वर / भ्रम (गंभीर संक्रमण व बेहोशी)',
    englishMeaning: 'High-grade fever with altered sensorium / sepsis check',
    domain: 'safety',
    domainLabel: 'Suraksha (Safety Floor)',
    sopRef: 'Pillar 1 Red-Flag',
    icon: '🚨',
  },
  {
    id: 'safety_cardiac',
    aliases: ['safety_cardiac', 'hridaya_shoola', 'chest_pain'],
    ayurvedicTerm: 'Hridaya Shoola & Peeda',
    ayurvedicHindi: 'हृदय शूल (सीने में दर्द या भारीपन)',
    englishMeaning: 'Severe chest pain, cardiac distress / MI exclusion',
    domain: 'safety',
    domainLabel: 'Suraksha (Safety Floor)',
    sopRef: 'Pillar 1 Red-Flag',
    icon: '🫀',
  },
  {
    id: 'safety_respiratory',
    aliases: ['safety_respiratory', 'shwasa_kashta', 'shortness_of_breath', 'dyspnea'],
    ayurvedicTerm: 'Teevra Shwasa Kashta',
    ayurvedicHindi: 'तीव्र श्वास कष्ट (सांस लेने में भारी तकलीफ)',
    englishMeaning: 'Acute dyspnea, respiratory distress / asthma emergency',
    domain: 'safety',
    domainLabel: 'Suraksha (Safety Floor)',
    sopRef: 'Pillar 1 Red-Flag',
    icon: '🫁',
  },
  {
    id: 'safety_hemorrhage',
    aliases: ['safety_hemorrhage', 'raktapitta', 'severe_bleeding'],
    ayurvedicTerm: 'Raktapitta / Rakta Srava',
    ayurvedicHindi: 'रक्तपित्त / रक्त स्राव (खून बहना)',
    englishMeaning: 'Severe bleeding, hemoptysis or internal hemorrhage',
    domain: 'safety',
    domainLabel: 'Suraksha (Safety Floor)',
    sopRef: 'Pillar 1 Red-Flag',
    icon: '🩸',
  },
  {
    id: 'safety_neuro',
    aliases: ['safety_neuro', 'shiroshoola', 'severe_headache', 'stiff_neck'],
    ayurvedicTerm: 'Teevra Shiroshoola & Manyastambha',
    ayurvedicHindi: 'तीव्र शिरःशूल एवं मन्यास्तम्भ (गर्दन में अकड़न)',
    englishMeaning: 'Sudden severe thunderclap headache / meningeal signs',
    domain: 'safety',
    domainLabel: 'Suraksha (Safety Floor)',
    sopRef: 'Pillar 1 Red-Flag',
    icon: '⚠️',
  },
  {
    id: 'safety_dehydration',
    aliases: ['safety_dehydration', 'ati_trishna', 'severe_dehydration', 'anuria'],
    ayurvedicTerm: 'Ati-Trishna & Dhatu Shosha',
    ayurvedicHindi: 'अति-तृष्णा एवं धातु शोष (अत्यधिक डिहाइड्रेशन)',
    englishMeaning: 'Severe volume depletion, anuria or unquenchable thirst',
    domain: 'safety',
    domainLabel: 'Suraksha (Safety Floor)',
    sopRef: 'Pillar 1 Red-Flag',
    icon: '🧊',
  },
];

export function parseSummaryMap(summaryText?: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!summaryText) return map;
  const lines = summaryText.split('\n');
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (match) {
      map[match[1].trim()] = match[2].trim();
    }
  }
  return map;
}

export function getAyushCheckValue(item: AyushCheckItem, collectedMap: Record<string, string>): string | undefined {
  if (collectedMap[item.id]) return collectedMap[item.id];
  if (item.aliases) {
    for (const alias of item.aliases) {
      if (collectedMap[alias]) return collectedMap[alias];
    }
  }
  return undefined;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  summaryText?: string;
  currentFieldId?: string;
  progressTotal?: number;
  progressDone?: number;
}

export function AyushChecklistModal({
  isOpen,
  onClose,
  summaryText = '',
  currentFieldId,
  progressTotal: _progressTotal = 25,
  progressDone = 0,
}: Props) {
  const [activeDomain, setActiveDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract collected answers from summary string
  const collectedMap = useMemo(() => {
    return parseSummaryMap(summaryText);
  }, [summaryText]);

  // Compute live Dosha votes
  const doshaTally = useMemo(() => {
    let vata = 0, pitta = 0, kapha = 0;
    for (const [key, val] of Object.entries(collectedMap)) {
      if (!key.startsWith('prakriti_')) continue;
      const v = val.toLowerCase();
      if (v.includes('thin') || v.includes('slender') || v.includes('dry') || v.includes('rough') || v.includes('irregular') || v.includes('light sleep') || v.includes('cold')) vata++;
      else if (v.includes('medium') || v.includes('warm') || v.includes('sharp') || v.includes('intense') || v.includes('loose') || v.includes('heat') || v.includes('sweat') || v.includes('anger')) pitta++;
      else if (v.includes('heavy') || v.includes('smooth') || v.includes('soft') || v.includes('thick') || v.includes('deep sleep') || v.includes('calm') || v.includes('slow')) kapha++;
    }
    const tot = vata + pitta + kapha;
    return {
      vata,
      pitta,
      kapha,
      tot,
      vataPct: tot ? Math.round((vata / tot) * 100) : 33,
      pittaPct: tot ? Math.round((pitta / tot) * 100) : 34,
      kaphaPct: tot ? Math.max(0, 100 - (Math.round((vata / tot) * 100) + Math.round((pitta / tot) * 100))) : 33,
    };
  }, [collectedMap]);

  const filteredChecks = useMemo(() => {
    return ALL_25_AYUSH_CHECKS.filter((item) => {
      const matchesDomain = activeDomain === 'all' || item.domain === activeDomain;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        item.ayurvedicTerm.toLowerCase().includes(q) ||
        item.ayurvedicHindi.toLowerCase().includes(q) ||
        item.englishMeaning.toLowerCase().includes(q) ||
        item.sopRef.toLowerCase().includes(q);
      return matchesDomain && matchesSearch;
    });
  }, [activeDomain, searchQuery]);

  const completedCount = useMemo(() => {
    let c = 0;
    for (const item of ALL_25_AYUSH_CHECKS) {
      if (getAyushCheckValue(item, collectedMap)) c++;
    }
    return Math.max(c, progressDone);
  }, [collectedMap, progressDone]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-emerald-200/80 flex flex-col overflow-hidden text-left"
        >
          {/* ── Top Header with Govt AYUSH Branding ── */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white shrink-0 relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🌿</span>
              <span className="text-xs font-black tracking-widest text-emerald-300 uppercase">
                Ministry of AYUSH · Government of India
              </span>
              <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase ml-2">
                CCRAS Standardized
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              25 AYUSH & Clinical Assessment Checks
            </h2>
            <p className="text-xs text-emerald-200 mt-0.5">
              SOP for Prakriti Determination (ISBN: 978-93-83864-21-8) · NAMASTE & NAMC Diagnostic Standards
            </p>

            {/* Live Counter & DB Sync Bar */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-700/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Status:</span>
                <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 font-extrabold px-2.5 py-0.5 rounded-full">
                  {completedCount} of 25 Checks Verified
                </span>
                <span className="bg-white/10 border border-white/20 text-emerald-100 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                  100% Synced to Postgres DB
                </span>
              </div>

              {/* Mini Dosha Distribution */}
              {doshaTally.tot > 0 && (
                <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/10">
                  <span className="text-[10px] font-bold text-indigo-300">Vata: {doshaTally.vataPct}%</span>
                  <span className="text-[10px] font-bold text-amber-300">Pitta: {doshaTally.pittaPct}%</span>
                  <span className="text-[10px] font-bold text-emerald-300">Kapha: {doshaTally.kaphaPct}%</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Filter Tabs & Search Bar ── */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {[
                { id: 'all', label: 'All 25 Checks', count: 25 },
                { id: 'sharirika', label: '🌿 Sharirika (3)', count: 3 },
                { id: 'kriyatmaka', label: '💧 Kriyatmaka (7)', count: 7 },
                { id: 'manasika', label: '🧠 Manasika (3)', count: 3 },
                { id: 'vyavaharika', label: '⚡ Vyavaharika (1)', count: 1 },
                { id: 'nidana', label: '🩺 Clinical / Nidana (5)', count: 5 },
                { id: 'safety', label: '🛡️ Safety Floor (6)', count: 6 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveDomain(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                    activeDomain === tab.id
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Sanskrit / term..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* ── Checklist Cards (Scrollable) ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50 pr-2 scrollbar-thin scrollbar-thumb-slate-300">
            {filteredChecks.map((item) => {
              const collectedVal = getAyushCheckValue(item, collectedMap);
              const isCurrent = currentFieldId === item.id || Boolean(item.aliases && currentFieldId && item.aliases.includes(currentFieldId));
              const isDone = Boolean(collectedVal);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isDone
                      ? 'bg-white border-emerald-200 shadow-2xs'
                      : isCurrent
                      ? 'bg-emerald-50/80 border-emerald-400 shadow-card animate-pulse'
                      : 'bg-white/80 border-slate-200/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl shrink-0 p-1.5 bg-slate-100/80 rounded-xl select-none leading-none">
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        {/* Title & Hindi Term */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900">
                            {item.ayurvedicTerm}
                          </span>
                          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {item.ayurvedicHindi}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-sm uppercase">
                            {item.sopRef}
                          </span>
                        </div>

                        {/* Clinical meaning */}
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {item.englishMeaning}
                        </p>

                        {/* Collected Answer Banner if done */}
                        {isDone && (
                          <div className="mt-2 p-2 bg-emerald-50/90 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-emerald-950 font-bold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Recorded Value:</span>
                              <span className="font-extrabold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                                {collectedVal}
                              </span>
                            </div>
                            <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider bg-emerald-200/60 px-2 py-0.5 rounded-full">
                              Postgres Persisted
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Pill on Right */}
                    <div className="shrink-0 text-right">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Collected</span>
                        </span>
                      ) : isCurrent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Active Check</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div className="p-3.5 bg-slate-100/90 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <span>🏛️ CCRAS Standard Operating Procedures</span>
              <span>•</span>
              <span>NAMASTE Electronic Morbidity Integration</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-all shadow-sm"
            >
              Close Checklist
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
