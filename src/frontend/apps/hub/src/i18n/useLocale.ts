import { DEFAULT_LOCALE, Locales } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import { convertLocaleToISO639_1 } from "@/features/language/utils/locale";

/**
 * The ui-kit locale (fr-FR, de-DE...) matching the interface language.
 */
export function useLocales() {
  const { i18n } = useTranslation();
  const language = convertLocaleToISO639_1(
    i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE,
  );
  return (
    Object.values(Locales).find(
      (locale) => convertLocaleToISO639_1(locale) === language,
    ) ?? DEFAULT_LOCALE
  );
}
