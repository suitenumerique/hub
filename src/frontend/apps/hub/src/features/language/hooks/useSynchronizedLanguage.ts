import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { User } from "@/features/auth/types";
import { useConfig } from "@/features/config/ConfigProvider";
import { getHubApi } from "@/features/config/HubApi";
import { getMatchingLocales } from "@/features/language/utils/locale";

/**
 * Keeps the interface language and the language saved on the user profile in
 * sync: the frontend uses the closest translated language, the backend the
 * closest language of its LANGUAGES setting. Only the languages offered by the
 * backend are used, the first one being the fallback.
 */
export const useSynchronizedLanguage = () => {
  const { i18n } = useTranslation();
  const { config } = useConfig();
  const isSynchronizingLanguage = useRef(false);

  const availableBackendLanguages = useMemo(
    () => config.LANGUAGES.map(([locale]) => locale),
    [config.LANGUAGES],
  );
  const availableFrontendLanguages = useMemo(
    () =>
      getMatchingLocales(
        Object.keys(i18n?.options?.resources || { en: "<- fallback" }),
        availableBackendLanguages,
      ),
    [i18n?.options?.resources, availableBackendLanguages],
  );

  const changeBackendLanguage = useCallback(
    async (language: string, user?: User | null) => {
      const closestBackendLanguage = getMatchingLocales(
        availableBackendLanguages,
        [language],
      )[0];

      if (
        !user ||
        !closestBackendLanguage ||
        user.language === closestBackendLanguage
      ) {
        return undefined;
      }
      return getHubApi().updateUser({
        id: user.id,
        language: closestBackendLanguage,
      });
    },
    [availableBackendLanguages],
  );

  const changeFrontendLanguage = useCallback(
    async (language: string) => {
      const closestFrontendLanguage = getMatchingLocales(
        availableFrontendLanguages,
        [language],
      )[0];
      if (
        closestFrontendLanguage &&
        i18n.isInitialized &&
        i18n.resolvedLanguage !== closestFrontendLanguage
      ) {
        await i18n.changeLanguage(closestFrontendLanguage);
      }
    },
    [availableFrontendLanguages, i18n],
  );

  /**
   * Resolves with the updated user when the profile language changed.
   */
  const changeLanguageSynchronized = useCallback(
    async (language: string, user?: User | null) => {
      if (isSynchronizingLanguage.current) {
        return undefined;
      }
      isSynchronizingLanguage.current = true;
      const offeredLanguage =
        getMatchingLocales(availableBackendLanguages, [language])[0] ??
        availableBackendLanguages[0] ??
        language;
      try {
        await changeFrontendLanguage(offeredLanguage);
        return await changeBackendLanguage(offeredLanguage, user);
      } finally {
        isSynchronizingLanguage.current = false;
      }
    },
    [availableBackendLanguages, changeBackendLanguage, changeFrontendLanguage],
  );

  return {
    changeLanguageSynchronized,
    changeFrontendLanguage,
    changeBackendLanguage,
  };
};
