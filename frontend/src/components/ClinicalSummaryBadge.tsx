import { Heart, User, Activity, AlertCircle, Flame, Wind, Droplets, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  summary: string | Record<string, any> | undefined | null;
  clinicMode?: string;
  emptyText?: string;
  showAllFields?: boolean;
}

// Predictor metadata dictionary for readable display and CCRAS categorization
const PREDICTOR_META: Record<string, { label: string; ayushLabel?: string; hindi?: string; domain: 'physical' | 'physiological' | 'psychological' | 'behavioral' | 'clinical' | 'safety'; icon: string; sopRef?: string }> = {
  // Physical (Sharirika)
  prakriti_built: { label: 'Body Frame (Built)', ayushLabel: 'Sharirika Samhanana / Deha', hindi: 'शारीरिक संहनन', domain: 'physical', icon: '🦴', sopRef: 'CCRAS SOP 1.1' },
  prakriti_skin: { label: 'Skin Complexion & Feel', ayushLabel: 'Twak Varna & Sparsha', hindi: 'त्वक् वर्ण एवं स्पर्श', domain: 'physical', icon: '✨', sopRef: 'CCRAS SOP 1.2' },
  prakriti_hair: { label: 'Hair Character', ayushLabel: 'Kesha Prakriti & Rupa', hindi: 'केश प्रकृति', domain: 'physical', icon: '💇', sopRef: 'CCRAS SOP 1.3' },
  
  // Physiological (Kriyatmaka)
  prakriti_appetite: { label: 'Hunger & Agni', ayushLabel: 'Agni & Kshudha Vega', hindi: 'अग्नि एवं क्षुधा वेग', domain: 'physiological', icon: '🔥', sopRef: 'CCRAS SOP 2.1' },
  prakriti_thirst: { label: 'Thirst Level', ayushLabel: 'Pipasa Pravritti', hindi: 'पिपासा प्रवृत्ति', domain: 'physiological', icon: '💧', sopRef: 'CCRAS SOP 2.2' },
  prakriti_bowel: { label: 'Bowel Habits (Koshtha)', ayushLabel: 'Koshtha Pariksha', hindi: 'कोष्ठ परीक्षा', domain: 'physiological', icon: '🩺', sopRef: 'CCRAS SOP 2.3' },
  prakriti_sweat: { label: 'Perspiration (Sweda)', ayushLabel: 'Sweda Pravritti', hindi: 'स्वेद प्रवृत्ति', domain: 'physiological', icon: '💦', sopRef: 'CCRAS SOP 2.4' },
  prakriti_sleep: { label: 'Sleep & Dreams (Nidra)', ayushLabel: 'Nidra & Swapna', hindi: 'निद्रा एवं स्वप्न', domain: 'physiological', icon: '🌙', sopRef: 'CCRAS SOP 2.5' },
  prakriti_joints: { label: 'Joint Stability (Sandhi)', ayushLabel: 'Sandhi Bandhana', hindi: 'सन्धि बन्धन', domain: 'physiological', icon: '🦵', sopRef: 'CCRAS SOP 2.6' },

  // Psychological (Manasika)
  prakriti_memory: { label: 'Memory & Recall', ayushLabel: 'Smriti & Grahanashakti', hindi: 'स्मृति एवं ग्रहणशक्ति', domain: 'psychological', icon: '🧠', sopRef: 'CCRAS SOP 3.2' },
  prakriti_temperament: { label: 'Emotional Disposition', ayushLabel: 'Manasa Prakriti / Amarsha', hindi: 'मानस प्रकृति / अमर्ष', domain: 'psychological', icon: '⚖️', sopRef: 'CCRAS SOP 3.3' },
  
  // Behavioral (Vyavaharika)
  prakriti_speech_pace: { label: 'Speech & Activity Pace', ayushLabel: 'Vak & Chesta Vega', hindi: 'वाक् एवं चेष्टा वेग', domain: 'behavioral', icon: '⚡', sopRef: 'CCRAS SOP 4.1' },
  prakriti_activity: { label: 'Speech & Activity Pace', ayushLabel: 'Vak & Chesta Vega', hindi: 'वाक् एवं चेष्टा वेग', domain: 'behavioral', icon: '⚡', sopRef: 'CCRAS SOP 4.1' },
  
  // Baseline Clinical / HPI
  symptom_onset: { label: 'Symptom Onset', ayushLabel: 'Hetu / Prathama Utpatti', hindi: 'हेतु / प्रथम उत्पत्ति', domain: 'clinical', icon: '📅', sopRef: 'NAMASTE Roga Hetu' },
  symptom_duration: { label: 'Symptom Duration', ayushLabel: 'Kala & Rogavastha', hindi: 'काल एवं रोगावस्था', domain: 'clinical', icon: '⏳', sopRef: 'NAMASTE Kala Mana' },
  symptom_severity: { label: 'Severity Level', ayushLabel: 'Vega & Bala Pramana', hindi: 'वेग एवं बल प्रमाण', domain: 'clinical', icon: '📊', sopRef: 'NAMASTE Roga Bala' },
  current_medications: { label: 'Current Medications', ayushLabel: 'Aushadha Sevana Itihasa', hindi: 'औषध सेवन इतिहास', domain: 'clinical', icon: '💊', sopRef: 'NAMASTE Aushadha' },
  fever_pattern: { label: 'Fever Pattern', ayushLabel: 'Sheetapurvaka Jwara Rupa', hindi: 'शीतपूर्वक ज्वर रूप', domain: 'clinical', icon: '🌡️', sopRef: 'NAMC: EB-1 (Jwara)' },
  chills_rigors: { label: 'Chills & Rigors', ayushLabel: 'Sheeta & Kampa', hindi: 'शीत एवं कम्प', domain: 'clinical', icon: '❄️', sopRef: 'NAMC: Jwara' },
  associated_symptoms: { label: 'Associated Symptoms', ayushLabel: 'Upadrava & Lakshana', hindi: 'उपद्रव एवं लक्षण', domain: 'clinical', icon: '🩺', sopRef: 'NAMASTE Roga' },

  // Safety / Red Flags (Suraksha)
  safety_sepsis: { label: 'Sepsis Check', ayushLabel: 'Sannipataja Jwara / Bhrama', hindi: 'सन्निपात ज्वर / भ्रम', domain: 'safety', icon: '🚨', sopRef: 'Pillar 1 Red-Flag' },
  safety_cardiac: { label: 'Cardiac Check', ayushLabel: 'Hridaya Shoola & Peeda', hindi: 'हृदय शूल एवं पीड़ा', domain: 'safety', icon: '🫀', sopRef: 'Pillar 1 Red-Flag' },
  safety_respiratory: { label: 'Respiratory Distress', ayushLabel: 'Teevra Shwasa Kashta', hindi: 'तीव्र श्वास कष्ट', domain: 'safety', icon: '🫁', sopRef: 'Pillar 1 Red-Flag' },
  safety_hemorrhage: { label: 'Hemorrhage Check', ayushLabel: 'Raktapitta / Rakta Srava', hindi: 'रक्तपित्त / रक्त स्राव', domain: 'safety', icon: '🩸', sopRef: 'Pillar 1 Red-Flag' },
  safety_neuro: { label: 'Severe Neuro Check', ayushLabel: 'Teevra Shiroshoola & Manyastambha', hindi: 'तीव्र शिरःशूल', domain: 'safety', icon: '⚠️', sopRef: 'Pillar 1 Red-Flag' },
  safety_dehydration: { label: 'Dehydration Check', ayushLabel: 'Ati-Trishna & Dhatu Shosha', hindi: 'अति-तृष्णा एवं धातु शोष', domain: 'safety', icon: '🧊', sopRef: 'Pillar 1 Red-Flag' },
};

function inferDosha(value: string): 'Vata' | 'Pitta' | 'Kapha' | null {
  const v = value.toLowerCase();
  if (v.includes('thin') || v.includes('slender') || v.includes('dry') || v.includes('rough') || 
      v.includes('irregular') || v.includes('fast') || v.includes('constipat') || v.includes('light sleep') || 
      v.includes('cold') || v.includes('change mind') || v.includes('forget') || v.includes('worry')) {
    return 'Vata';
  }
  if (v.includes('medium') || v.includes('proportion') || v.includes('warm') || v.includes('sensitive') || 
      v.includes('fine') || v.includes('sharp') || v.includes('intense') || v.includes('frequent') || 
      v.includes('loose') || v.includes('moderate sleep') || v.includes('heat') || v.includes('sweat') || 
      v.includes('decisive') || v.includes('anger') || v.includes('articulate')) {
    return 'Pitta';
  }
  if (v.includes('heavy') || v.includes('broad') || v.includes('smooth') || v.includes('soft') || 
      v.includes('thick') || v.includes('lustrous') || v.includes('steady') || v.includes('slow') || 
      v.includes('formed') || v.includes('deep sleep') || v.includes('hard to wake') || v.includes('damp') || 
      v.includes('remember') || v.includes('patient') || v.includes('forgiv')) {
    return 'Kapha';
  }
  return null;
}

export function ClinicalSummaryBadge({ summary, clinicMode = 'allopathic', emptyText = 'Awaiting clinical information...', showAllFields = false }: Props) {
  const isAyush = clinicMode === 'ayush' || (typeof summary === 'string' && summary.includes('prakriti_'));

  const parsedData = useMemo(() => {
    if (!summary) return null;
    const rawText = typeof summary === 'string' ? summary : JSON.stringify(summary);

    // Standard tokens
    const complaintMatch = rawText.match(/Chief Complaint:\s*(.+?)(?=\s+(?:Category|Patient|weight|vitals|height|BMI)|[,\n]|$)/i);
    const patientMatch = rawText.match(/Patient:\s*(.+?)(?=\s+(?:Category|weight|vitals|height|BMI)|[,\n]|$)/i);
    const vitalsMatch = rawText.match(/vitals:\s*(.+?)(?=\s+(?:Category|Patient|weight|height|BMI)|[,\n]|$)/i);
    const bmiMatch = rawText.match(/BMI:\s*([0-9.]+)/i);
    const weightMatch = rawText.match(/weight:\s*([0-9.]+)/i);

    const complaint = complaintMatch ? complaintMatch[1].trim() : null;
    const patient = patientMatch ? patientMatch[1].trim() : null;
    const vitals = vitalsMatch ? vitalsMatch[1].trim() : null;
    const bmi = bmiMatch ? bmiMatch[1].trim() : null;
    const weight = weightMatch ? weightMatch[1].trim() : null;

    // Parse ALL dynamic line entries: "field_id: value"
    const lines = rawText.split('\n');
    const collectedFields: Array<{ id: string; label: string; sopRef?: string; value: string; domain: string; icon: string; dosha: 'Vata' | 'Pitta' | 'Kapha' | null }> = [];
    
    let vataCount = 0;
    let pittaCount = 0;
    let kaphaCount = 0;

    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (match) {
        const fieldId = match[1].trim();
        const value = match[2].trim();

        // Skip the meta headers already captured
        if (['Chief Complaint', 'Category', 'Patient', 'vitals', 'BMI', 'weight'].includes(fieldId)) {
          continue;
        }

        const meta = PREDICTOR_META[fieldId] || {
          label: fieldId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          ayushLabel: fieldId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          hindi: '',
          domain: fieldId.startsWith('prakriti_') ? 'physiological' : 'clinical',
          icon: fieldId.startsWith('prakriti_') ? '🌿' : '🩺',
          sopRef: undefined,
        };

        const displayLabel = isAyush && meta.ayushLabel 
          ? `${meta.ayushLabel}${meta.hindi ? ` (${meta.hindi})` : ''}` 
          : meta.label;

        const dosha = fieldId.startsWith('prakriti_') ? inferDosha(value) : null;
        if (dosha === 'Vata') vataCount++;
        else if (dosha === 'Pitta') pittaCount++;
        else if (dosha === 'Kapha') kaphaCount++;

        collectedFields.push({
          id: fieldId,
          label: displayLabel,
          sopRef: meta.sopRef,
          value,
          domain: meta.domain,
          icon: meta.icon,
          dosha,
        });
      }
    }

    const totalDoshaVotes = vataCount + pittaCount + kaphaCount;
    const vataPct = totalDoshaVotes ? Math.round((vataCount / totalDoshaVotes) * 100) : 33;
    const pittaPct = totalDoshaVotes ? Math.round((pittaCount / totalDoshaVotes) * 100) : 34;
    const kaphaPct = totalDoshaVotes ? Math.max(0, 100 - (vataPct + pittaPct)) : 33;

    let dominantPrakriti = 'Evaluating...';
    if (totalDoshaVotes > 0) {
      if (pittaCount >= vataCount && pittaCount >= kaphaCount) {
        dominantPrakriti = vataCount >= 2 ? 'Pitta-Vataja (Dual)' : 'Pittaja Dominant';
      } else if (vataCount >= pittaCount && vataCount >= kaphaCount) {
        dominantPrakriti = pittaCount >= 2 ? 'Vata-Pittaja (Dual)' : 'Vataja Dominant';
      } else {
        dominantPrakriti = 'Kaphaja Dominant';
      }
    }

    return {
      complaint,
      patient,
      vitals,
      bmi,
      weight,
      collectedFields,
      doshaStats: {
        vataCount,
        pittaCount,
        kaphaCount,
        total: totalDoshaVotes,
        vataPct,
        pittaPct,
        kaphaPct,
        dominantPrakriti,
      }
    };
  }, [summary]);

  if (!summary || !parsedData) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-400 font-medium italic">
        <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>{emptyText}</span>
      </div>
    );
  }

  const { complaint, patient, vitals, bmi, weight, collectedFields, doshaStats } = parsedData;

  return (
    <div className="space-y-2.5">
      {/* ── Top Demographic Cards (Pinned) ── */}
      <div className="grid grid-cols-2 gap-1.5">
        {complaint && (
          <div className="col-span-2 flex items-center gap-2 p-2 bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200/70 rounded-xl shadow-2xs">
            <span className="text-base shrink-0">🌡️</span>
            <div className="min-w-0">
              <span className="block text-[9px] font-extrabold uppercase tracking-wider text-blue-600">Chief Complaint</span>
              <span className="block text-xs font-bold text-slate-800 truncate capitalize">{complaint}</span>
            </div>
          </div>
        )}

        {patient && (
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-50 border border-slate-200/80 rounded-lg">
            <User className="w-3 h-3 text-slate-500 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">Patient</span>
              <span className="block text-[11px] font-bold text-slate-700 truncate">{patient}</span>
            </div>
          </div>
        )}

        {vitals && (
          <div className="flex items-center gap-1.5 p-1.5 bg-emerald-50/80 border border-emerald-200/70 rounded-lg">
            <Heart className="w-3 h-3 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[8px] font-bold uppercase tracking-wider text-emerald-600">BP / Vitals</span>
              <span className="block text-[11px] font-bold text-emerald-900 truncate">{vitals}</span>
            </div>
          </div>
        )}

        {bmi && (
          <div className="col-span-2 flex items-center gap-1.5 p-1.5 bg-teal-50 border border-teal-200/70 rounded-lg">
            <Activity className="w-3 h-3 text-teal-600 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[8px] font-bold uppercase tracking-wider text-teal-600">BMI</span>
              <span className="block text-[11px] font-bold text-teal-900 truncate">{bmi} {weight ? `(${weight}kg)` : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── AYUSH MODE: Live CCRAS Prakriti Meter ── */}
      {isAyush && (
        <div className="p-2.5 bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-amber-50/50 border border-emerald-300/80 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">🌿</span>
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                CCRAS Prakriti Assessment
              </span>
            </div>
            <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-sm">
              GOVT SOP
            </span>
          </div>

          {/* Dominant Prediction */}
          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-800 mb-1.5">
            <span className="text-slate-500 font-semibold text-[10px]">Dominant:</span>
            <span className="text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
              {doshaStats.dominantPrakriti}
            </span>
          </div>

          {/* Doshic Distribution Progress Bar */}
          <div className="w-full bg-slate-200/80 rounded-full h-2 flex overflow-hidden shadow-inner mb-1.5">
            <div 
              className="bg-indigo-500 h-full transition-all duration-500" 
              style={{ width: `${doshaStats.vataPct}%` }} 
              title={`Vata: ${doshaStats.vataPct}%`} 
            />
            <div 
              className="bg-amber-500 h-full transition-all duration-500" 
              style={{ width: `${doshaStats.pittaPct}%` }} 
              title={`Pitta: ${doshaStats.pittaPct}%`} 
            />
            <div 
              className="bg-emerald-500 h-full transition-all duration-500" 
              style={{ width: `${doshaStats.kaphaPct}%` }} 
              title={`Kapha: ${doshaStats.kaphaPct}%`} 
            />
          </div>

          {/* Mini Legend */}
          <div className="flex items-center justify-between text-[9px] font-bold text-slate-600 px-0.5">
            <span className="flex items-center gap-1 text-indigo-700">
              <Wind className="w-2.5 h-2.5" /> Vata {doshaStats.vataPct}%
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <Flame className="w-2.5 h-2.5" /> Pitta {doshaStats.pittaPct}%
            </span>
            <span className="flex items-center gap-1 text-emerald-700">
              <Droplets className="w-2.5 h-2.5" /> Kapha {doshaStats.kaphaPct}%
            </span>
          </div>
        </div>
      )}

      {/* ── Collected Fields List (Scrollable) ── */}
      {collectedFields.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Collected Fields ({collectedFields.length})</span>
            </span>
            <span className="text-[9px] font-bold text-slate-400">
              DB SYNCED 100%
            </span>
          </div>

          <div className={`space-y-1.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 ${showAllFields ? 'max-h-[380px]' : 'max-h-[140px]'}`}>
            {collectedFields.map((field) => (
              <div 
                key={field.id}
                className="p-1.5 bg-slate-50/90 hover:bg-white border border-slate-200/80 rounded-lg transition-colors text-left"
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[10px] font-bold text-slate-700 truncate flex items-center gap-1">
                    <span>{field.icon}</span>
                    <span>{field.label}</span>
                  </span>
                  {field.dosha && (
                    <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-full shrink-0 ${
                      field.dosha === 'Vata' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                      field.dosha === 'Pitta' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {field.dosha}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-600 font-medium line-clamp-2 pl-4">
                  {field.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
