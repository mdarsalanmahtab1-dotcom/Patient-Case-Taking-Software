import { LiquidButton } from '../components/ui/button';
import { useState, useRef } from 'react';
import { Camera, UploadCloud, X, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { useEffect } from 'react';
import { useAudioGuide } from '../hooks/useAudioGuide';

function DynamicLoadingText() {
  const [index, setIndex] = useState(0);
  const messages = [
    "Encrypting secure upload...",
    "Scanning document structure...",
    "Extracting clinical entities...",
    "Cross-referencing medical databases...",
    "Finalizing digitization..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <motion.span 
      key={index}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="text-xs font-bold text-blue-900 uppercase tracking-wider"
    >
      {messages[index]}
    </motion.span>
  );
}

interface Props {
  language: string;
  onNext: (files: File[]) => Promise<void> | void;
  onSkip: () => void;
}

export function Screen5_DocumentScanner({ onNext, onSkip }: Props) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { speak, stop } = useAudioGuide();
  
  useEffect(() => {
    speak('upload_docs');
    return () => stop();
  }, [speak, stop]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length + files.length > 5) {
        alert("Maximum 5 images allowed.");
        return;
      }
      
      const newFiles = [...files, ...selectedFiles];
      setFiles(newFiles);
      
      const newPreviews = [...previews];
      selectedFiles.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            newPreviews.push(reader.result as string);
            setPreviews([...newPreviews]); // Trigger re-render with new array
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const handleClear = () => {
    setFiles([]);
    setPreviews([]);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (files.length > 0) {
      setIsProcessing(true);
      setErrorMsg(null);
      try {
        await onNext(files);
      } catch (err: any) {
        setErrorMsg(err.message || "Document verification failed. Please check the document and re-upload.");
        setIsProcessing(false);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col flex-1 p-6 sm:p-12 items-center text-center h-full"
    >
      <div className="w-full max-w-3xl mb-8 sm:mb-12">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 mb-3 sm:mb-4 tracking-tight">{t('docs.title')}</h2>
        <p className="text-base sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          {t('docs.subtitle')}
        </p>
      </div>

      <div className="flex-1 w-full max-w-3xl flex flex-col justify-center relative">
        <input 
          type="file" 
          accept="image/*,.pdf" 
          className="hidden" 
          ref={fileInputRef} 
          multiple
          onChange={handleFileChange} 
        />
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={cameraInputRef} 
          multiple
          onChange={handleFileChange} 
        />

        {files.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-full max-h-[400px]">
            {/* Camera Option — Slides from left */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <LiquidButton
                onClick={() => cameraInputRef.current?.click()}
                className="group w-full h-full flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-[2rem] p-8 shadow-card hover:shadow-card-hover hover:-translate-y-1 active:scale-[0.97] transition-[transform,box-shadow,background-color] duration-150 cursor-pointer"
              >
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200 shadow-inner">
                  <Camera className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('docs.take_photo')}</h3>
                <p className="text-slate-500 font-medium">{t('docs.hold_document')}</p>
              </LiquidButton>
            </motion.div>

            {/* Upload Option — Slides from right */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <LiquidButton
                onClick={() => fileInputRef.current?.click()}
                className="group w-full h-full flex flex-col items-center justify-center bg-white border border-slate-200/80 rounded-[2rem] p-8 shadow-card hover:shadow-card-hover hover:-translate-y-1 active:scale-[0.97] transition-[transform,box-shadow,background-color] duration-150 cursor-pointer"
              >
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-200 shadow-inner">
                  <UploadCloud className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('docs.upload_file')}</h3>
                <p className="text-slate-500 font-medium">{t('docs.pdf_or_image')} (Max 5)</p>
              </LiquidButton>
            </motion.div>
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center bg-white rounded-[2.5rem] p-8 shadow-card-hover h-full max-h-[400px] relative overflow-hidden border border-slate-200/80"
          >
            <LiquidButton
              onClick={handleClear}
              disabled={isProcessing}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-full transition-colors active:scale-[0.97] disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <X className="w-6 h-6" />
            </LiquidButton>

            <div className="flex flex-wrap justify-center gap-4 w-full h-full overflow-y-auto pt-8">
              {previews.map((prev, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden border-2 border-slate-200 relative shrink-0 shadow-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={prev} alt={`Preview ${idx+1}`} className="w-full h-full object-cover" />
                </motion.div>
              ))}
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-10 flex flex-col items-center justify-center p-4 text-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                <DynamicLoadingText />
              </div>
            )}
            
            {errorMsg ? (
              <div className="mt-4 text-center bg-red-50 border border-red-200 rounded-xl p-4 w-full">
                <p className="text-red-600 font-bold text-sm sm:text-base">{errorMsg}</p>
                <p className="text-red-500 text-xs mt-1">Please clear and try again.</p>
              </div>
            ) : (
              <div className="mt-4 text-center">
                <h3 className="text-lg font-bold text-slate-800">
                  {files.length} document{files.length !== 1 ? 's' : ''} ready
                </h3>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="mt-auto pt-8 sm:pt-10 w-full max-w-4xl flex gap-4 sm:gap-6">
        <LiquidButton
          onClick={onSkip}
          disabled={isProcessing}
          className="group flex items-center justify-center gap-2 px-6 sm:px-8 py-4 sm:py-5 rounded-full font-extrabold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-[transform,background-color] duration-150 active:scale-[0.97] w-1/3 text-base sm:text-lg disabled:opacity-50 cursor-pointer shadow-2xs"
        >
          {t('docs.skip')}
        </LiquidButton>
        <LiquidButton
          onClick={handleSubmit}
          disabled={files.length === 0 || isProcessing}
          className={`group relative flex-1 overflow-hidden flex items-center justify-center gap-3 rounded-full py-4 sm:py-5 font-extrabold shadow-card-hover transition-[transform,background-color,box-shadow] duration-150 transform active:scale-[0.97] text-lg sm:text-xl cursor-pointer ${
            files.length > 0 && !isProcessing
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20 hover:shadow-blue-600/30'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          {isProcessing ? (
             <span className="relative z-10 flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                {t('docs.analyzing_document')}
             </span>
          ) : (
            <>
              <span className="relative z-10 flex items-center gap-2">
                {t('docs.process_document')}
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1.5 transition-transform" />
              </span>
            </>
          )}
        </LiquidButton>
      </div>
    </motion.div>
  );
}
