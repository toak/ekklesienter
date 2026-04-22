/// <reference types="vite/client" />
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';
import ru from './locales/ru';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    supportedLngs: ['en', 'ru'],

    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },

    interpolation: {
      escapeValue: false,
    },
    returnObjects: true,
  });

export default i18n;