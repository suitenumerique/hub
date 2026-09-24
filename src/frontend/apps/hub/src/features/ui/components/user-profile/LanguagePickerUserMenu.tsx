import { LanguagePicker } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/Auth";
import { getHubApi } from "@/features/config/HubApi";

const LANGUAGES = [
  { label: "Français", value: "fr-fr", shortLabel: "FR" },
  { label: "English", value: "en-us", shortLabel: "EN" },
  { label: "Deutsch", value: "de-de", shortLabel: "DE" },
];

export const useUserLanguage = () => {
  const { i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const hubApi = getHubApi();
  const selected = i18n.resolvedLanguage ?? i18n.language;

  const onChange = (value: string) => {
    const previous = selected;
    void i18n.changeLanguage(value);
    if (!user) {
      return;
    }
    hubApi
      .updateUser({ id: user.id, language: value })
      .then(() => refreshUser?.())
      .catch(() => {
        // Roll back: server didn't accept the change, keep UI consistent.
        void i18n.changeLanguage(previous);
      });
  };

  return {
    languages: LANGUAGES.map((language) => ({
      ...language,
      isChecked:
        language.value.toLowerCase().split("-")[0] ===
        selected.toLowerCase().split("-")[0],
    })),
    onChange,
  };
};

export const LanguagePickerUserMenu = () => {
  const { languages, onChange } = useUserLanguage();
  return (
    <LanguagePicker
      languages={languages}
      size="small"
      onChange={onChange}
      compact
    />
  );
};
