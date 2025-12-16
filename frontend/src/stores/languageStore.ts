import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Language, Translations } from '../i18n/types';
import { ko } from '../i18n/ko';
import { en } from '../i18n/en';

const translations: Record<Language, Translations> = { ko, en };

// Language display names
export const languageNames: Record<Language, string> = {
  ko: '한국어',
  en: 'English',
};

// Available languages
export const availableLanguages: Language[] = ['ko', 'en'];

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
}

// Helper function to interpolate variables in translation strings
// e.g., "피드 {count}개" with { count: 5 } -> "피드 5개"
export function interpolate(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'ko',
      t: translations.ko,
      setLanguage: (language: Language) => {
        set({ language, t: translations[language] });
      },
    }),
    {
      name: 'language-storage',
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, ensure `t` is set correctly based on persisted language
        if (state) {
          state.t = translations[state.language];
        }
      },
    }
  )
);

// Hook for easy access to translations
export function useTranslation() {
  const { t, language, setLanguage } = useLanguageStore();
  return { t, language, setLanguage, interpolate };
}
