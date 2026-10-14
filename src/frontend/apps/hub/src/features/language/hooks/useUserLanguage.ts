import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/Auth";
import { useConfig } from "@/features/config/ConfigProvider";
import { useSynchronizedLanguage } from "@/features/language/hooks/useSynchronizedLanguage";
import {
  convertLocaleToISO639_1,
  getClosestLocale,
} from "@/features/language/utils/locale";

/**
 * Language options of the user menu, taken from the backend LANGUAGES setting.
 */
export const useUserLanguage = () => {
  const { i18n } = useTranslation();
  const { config } = useConfig();
  const { user, refreshUser } = useAuth();
  const { changeLanguageSynchronized, changeFrontendLanguage } =
    useSynchronizedLanguage();
  const selected = i18n.resolvedLanguage ?? i18n.language;

  const languages = useMemo(() => {
    const currentLocale = getClosestLocale(
      config.LANGUAGES.map(([locale]) => locale),
      selected,
    );
    return config.LANGUAGES.map(([value, label]) => ({
      label,
      value,
      shortLabel: convertLocaleToISO639_1(value).toUpperCase(),
      isChecked: value === currentLocale,
    }));
  }, [config.LANGUAGES, selected]);

  const onChange = (value: string) => {
    const previous = selected;
    changeLanguageSynchronized(value, user)
      .then((updatedUser) => {
        if (updatedUser) {
          void refreshUser?.();
        }
      })
      .catch(() => {
        // Roll back: server didn't accept the change, keep UI consistent.
        void changeFrontendLanguage(previous);
      });
  };

  return { languages, onChange };
};
