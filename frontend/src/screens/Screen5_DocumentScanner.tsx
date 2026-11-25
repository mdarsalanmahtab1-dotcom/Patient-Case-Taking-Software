import { toast } from '../components/Toast';
import { useState, useRef, useEffect } from 'react';
import { Camera, UploadCloud, X, ArrowRight, Loader2, FileText, Plus, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { useAudioGuide } from '../hooks/useAudioGuide';

const MAX_FILES = 5;

/** Rotating status line while the batch OCR request runs (one request for all pages). */
function ReadingStatus() {
  const [index, setIndex] = useState(0);
  const messages = [
    'Uploading your pages securely…',
    'Reading the text on each page…',
    'Picking out medicines, tests and diagnoses…',
    'Almost done…',
  ];

  useEffect(() => {
    const interval = setInterval(() => setIndex((prev) => Math.min(prev + 1, messages.length - 1)), 1800);
    return () => clearInterval(interval);
  }, [messages.length]);

  return <span className="text-base font-medium text-slate-700" aria-live="polite">{messages[index]}</span>;
}

interface Props {
  language: string;
  onNext: (files: File[]) => Promise<void> | void;
  onSkip: () => void;
}

interface Page {
  file: File;
  /** Object URL for images; null for PDFs */
  url: string | null;
}

export function Screen5_DocumentScanner({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<Page[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { speak, stop } = useAudioGuide();

  useEffect(() => {
    speak('upload_docs', undefined, 1);
    return () => stop();
  }, [speak, stop]);

  // Release preview URLs when the screen unmounts
  const pagesRef = useRef<Page[]>([]);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach(p => p.url && URL.revokeObjectURL(p.url)), []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (selected.length === 0) return;
    if (selected.length + pages.length > MAX_FILES) {
      toast.info(`You can add up to ${MAX_FILES} pages.`);
      return;
    }
    setErrorMsg(null);
    setPages(prev => [
      ...prev,
      ...selected.map(file => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })),
    ]);
  };

  const removeAt = (idx: number) => {
    setErrorMsg(null);
    setPages(prev => {
      const p = prev[idx];
      if (p?.url) URL.revokeObjectURL(p.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    stop();
    if (pages.length === 0) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await onNext(pages.map(p => p.file));
    } catch (err: any) {
      setErrorMsg(err.message || 'We could not read these pages. Check they are a clear photo of your own document and try again.');
      setIsProcessing(false);
    }
  };

  const tileBase =
    'group flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 bg-white p-6 text-center shadow-card transition-[border-color,box-shadow] duration-150 hover:shadow-card-hover cursor-pointer';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col flex-1 items-center h-full overflow-y-auto px-4 py-8 sm:px-8 sm:py-10"
    >
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{t('docs.title')}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">{t('docs.subtitle')}</p>
      </div>

      <input type="file" accept="image/*,.pdf" className="hidden" ref={fileInputRef} multiple onChange={handleFileChange} />
      <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} multiple onChange={handleFileChange} />

      <div className="mt-8 w-full max-w-3xl flex-1">
        {pages.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => cameraInputRef.current?.click()} className={`${tileBase} border-blue-600`}>
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Camera className="h-8 w-8" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-2xl font-bold text-slate-900">{t('docs.take_photo')}</span>
                <span className="mt-1 block text-base text-slate-600">{t('docs.hold_document')}</span>
              </span>
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`${tileBase} border-slate-200 hover:border-slate-400`}>
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <UploadCloud className="h-8 w-8" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-2xl font-bold text-slate-900">{t('docs.upload_file')}</span>
                <span className="mt-1 block text-base text-slate-600">{t('docs.pdf_or_image')} · up to {MAX_FILES}</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {pages.length} {pages.length === 1 ? 'page' : 'pages'} added
              </h2>
              <span className="text-sm text-slate-500">{MAX_FILES - pages.length} more allowed</span>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pages.map((p, idx) => (
                <li key={p.url || `${p.file.name}-${idx}`} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {p.url ? (
                    <img src={p.url} alt={`Page ${idx + 1}`} className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 p-3 text-center">
                      <FileText className="h-10 w-10 text-slate-500" aria-hidden="true" />
                      <span className="w-full truncate text-sm text-slate-600">{p.file.name}</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-lg bg-white/95 px-2 py-0.5 text-sm font-semibold text-slate-700 tabular-nums">{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    disabled={isProcessing}
                    aria-label={`Remove page ${idx + 1}`}
                    className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-card hover:bg-red-50 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {pages.length < MAX_FILES && !isProcessing && (
                <li>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <Plus className="h-8 w-8" aria-hidden="true" />
                    <span className="text-base font-semibold">Add page</span>
                  </button>
                </li>
              )}
            </ul>

            {isProcessing && (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-blue-50 p-4">
                <Loader2 className="h-6 w-6 shrink-0 animate-spin text-blue-600" aria-hidden="true" />
                <ReadingStatus />
              </div>
            )}

            {errorMsg && (
              <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                <div>
                  <p className="text-base font-semibold text-red-800">{errorMsg}</p>
                  <p className="mt-0.5 text-sm text-red-700">Remove the page that didn't work, or retake it, then try again.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 w-full max-w-3xl flex gap-3">
        <button
          type="button"
          onClick={() => { stop(); onSkip(); }}
          disabled={isProcessing}
          className="tap-kiosk w-1/3 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          {t('docs.skip')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pages.length === 0 || isProcessing}
          className="tap-kiosk flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-lg font-semibold text-white shadow-card hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
        >
          {isProcessing ? (
            <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {t('docs.analyzing_document')}</>
          ) : (
            <>{t('docs.process_document')} <ArrowRight className="h-5 w-5" aria-hidden="true" /></>
          )}
        </button>
      </div>
    </motion.div>
  );
}
