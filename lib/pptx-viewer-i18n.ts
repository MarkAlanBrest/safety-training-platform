import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { translationsEn } from "pptx-react-viewer/i18n";

const pptxViewerI18n = createInstance();

if (!pptxViewerI18n.isInitialized) {
  void pptxViewerI18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: {
      en: {
        translation: translationsEn,
      },
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default pptxViewerI18n;
