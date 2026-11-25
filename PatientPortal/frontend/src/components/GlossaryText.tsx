import { useMemo, useState } from 'react';
import { MEDICAL_GLOSSARY } from '../data/medicalGlossary';
import { useTranslation } from '../i18n/LanguageContext';

// One regex for every glossary key, longest first so "type 2 diabetes" wins over "diabetes".
const KEYS = Object.keys(MEDICAL_GLOSSARY).sort((a, b) => b.length - a.length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERM_RE = KEYS.length ? new RegExp(`\\b(${KEYS.map(escape).join('|')})\\b`, 'gi') : null;

/**
 * Renders text with medical terms underlined. Tapping a term shows a plain-language
 * meaning (in the patient's language) directly under the message.
 */
export function GlossaryText({ text }: { text: string }) {
  const { language } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);

  const parts = useMemo(() => {
    if (!TERM_RE) return [text];
    const out: (string | { key: string; label: string })[] = [];
    let last = 0;
    for (const m of text.matchAll(TERM_RE)) {
      const idx = m.index ?? 0;
      if (idx > last) out.push(text.slice(last, idx));
      out.push({ key: m[0].toLowerCase(), label: m[0] });
      last = idx + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [text]);

  const entry = open ? MEDICAL_GLOSSARY[open] : null;
  const meaning = entry ? (entry.meaning as Record<string, string>)[language] || entry.meaning.en : '';

  return (
    <>
      <span>
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            <span key={i}>{p}</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(o => (o === p.key ? null : p.key))}
              aria-expanded={open === p.key}
              className="inline font-semibold text-blue-800 underline decoration-dotted decoration-2 underline-offset-4 cursor-help"
            >
              {p.label}
            </button>
          )
        )}
      </span>
      {entry && (
        <span role="note" className="mt-2 block rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-sm text-slate-800">
          <span className="block font-semibold text-blue-900">{entry.term}</span>
          {meaning}
        </span>
      )}
    </>
  );
}
