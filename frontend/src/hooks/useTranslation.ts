import { useCallback } from 'react';
import { useAudioGuideContext } from '../context/AudioGuideContext';
import { translations } from '../i18n/translations';
import type { UILanguage } from '../i18n/translations';

/**
 * Hook for translating UI text based on the current uiLang.
 * 
 * Usage:
 *   const { t } = useTranslation();
 *   <h1>{t('consent.title')}</h1>
 *   <p>{t('complete.token_msg', { token: '42', dest: 'Room 3' })}</p>
 */
export function useTranslation() {
  const { uiLang } = useAudioGuideContext();

  const t = useCallback((key: string, replacements?: Record<string, string>): string => {
    const lang = (uiLang || 'en') as UILanguage;
    let text = translations[lang]?.[key]
            || translations['en']?.[key]
            || key; // fallback to key itself if missing

    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [uiLang]);

  return { t, uiLang };
}
