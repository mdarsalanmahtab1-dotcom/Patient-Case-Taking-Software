import { Heart, User, Activity, AlertCircle } from 'lucide-react';

interface Props {
  summary: string | Record<string, any> | undefined | null;
  emptyText?: string;
}

export function ClinicalSummaryBadge({ summary, emptyText = 'Awaiting clinical information...' }: Props) {
  if (!summary) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-400 font-medium italic">
        <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>{emptyText}</span>
      </div>
    );
  }

  const rawText = typeof summary === 'string' ? summary : JSON.stringify(summary);

  // Extract structured tokens using regex
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

  // If structured fields could not be matched, render the cleaned text in an elevated card
  const hasStructured = Boolean(complaint || patient || vitals || bmi);

  return (
    <div className="space-y-2">
      {hasStructured ? (
        <div className="grid grid-cols-2 gap-2">
          {complaint && (
            <div className="col-span-2 flex items-center gap-2 p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200/70 rounded-xl shadow-2xs">
              <span className="text-base shrink-0">🌡️</span>
              <div className="min-w-0">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-blue-600">Chief Complaint</span>
                <span className="block text-xs font-bold text-slate-800 truncate capitalize">{complaint}</span>
              </div>
            </div>
          )}

          {patient && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200/80 rounded-xl">
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Patient</span>
                <span className="block text-xs font-bold text-slate-700 truncate">{patient}</span>
              </div>
            </div>
          )}

          {vitals && (
            <div className="flex items-center gap-2 p-2 bg-emerald-50/80 border border-emerald-200/70 rounded-xl">
              <Heart className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-600">BP / Vitals</span>
                <span className="block text-xs font-bold text-emerald-900 truncate">{vitals}</span>
              </div>
            </div>
          )}

          {bmi && (
            <div className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-200/70 rounded-xl">
              <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <div className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-teal-600">BMI</span>
                <span className="block text-xs font-bold text-teal-900 truncate">{bmi} {weight ? `(${weight}kg)` : ''}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/60 p-3 rounded-xl border border-blue-100 shadow-2xs text-xs font-medium text-slate-700 leading-relaxed max-h-[140px] overflow-y-auto">
          {rawText}
        </div>
      )}
    </div>
  );
}
