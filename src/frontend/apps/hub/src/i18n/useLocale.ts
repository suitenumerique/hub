import { DEFAULT_LOCALE } from "@gouvfr-lasuite/cunningham-react";
import { useTranslation } from "react-i18next";

enum Locales {
  enUS = "en-US",
  frFR = "fr-FR",
  deDE = "de-DE",
  nlNL = "nl-NL",
}

const LOCALE_BY_LANGUAGE: Record<string, Locales> = {
  en: Locales.enUS,
  fr: Locales.frFR,
  de: Locales.deDE,
  nl: Locales.nlNL,
};

export function useLocales() {
  const { i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage ?? i18n.language;
  const lang = (resolvedLanguage || "en").slice(0, 2).toLowerCase();
  return LOCALE_BY_LANGUAGE[lang] ?? DEFAULT_LOCALE;
}
