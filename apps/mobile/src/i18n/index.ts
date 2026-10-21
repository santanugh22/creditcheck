import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import hi from "./hi";

const LANGUAGE_STORAGE_KEY = "@miniledger_language";

const resources = {
  en: { translation: en },
  hi: { translation: hi },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en", // Default fallback before AsyncStorage loads
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: "v3",
});

// Load persisted language preference on startup
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((storedLang) => {
    if (storedLang === "en" || storedLang === "hi") {
      i18n.changeLanguage(storedLang);
    }
  })
  .catch(() => {});

export async function changeAppLanguage(lang: "en" | "hi"): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (_e) {}
}

export default i18n;
