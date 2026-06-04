import { LanguagePicker } from "@gouvfr-lasuite/ui-kit";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/Auth";
import { getHubApi } from "@/features/config/HubApi";

const LANGUAGES = [
  { label: "Français", value: "fr-FR", shortLabel: "FR" },
  { label: "English", value: "en-US", shortLabel: "EN" },
  { label: "Deutsch", value: "de-DE", shortLabel: "DE" },
];

export const LanguagePickerUserMenu = () => {
  const { i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const hubApi = getHubApi();
  const [selected, setSelected] = useState<string>(
    user?.language ?? i18n.language,
  );

  // Re-sync if the user's stored language changes outside this menu (e.g.
  // language picked in another tab and mirrored back through refreshUser).
  useEffect(() => {
    if (user?.language && user.language !== selected) {
      setSelected(user.language);
    }
  }, [user?.language, selected]);

  const onChange = (value: string) => {
    const previous = selected;
    setSelected(value);
    void i18n.changeLanguage(value);
    if (!user) {
      return;
    }
    hubApi
      .updateUser({ id: user.id, language: value })
      .then(() => refreshUser?.())
      .catch(() => {
        // Roll back: server didn't accept the change, keep UI consistent.
        setSelected(previous);
        void i18n.changeLanguage(previous);
      });
  };

  return (
    <LanguagePicker
      languages={LANGUAGES.map((language) => ({
        ...language,
        isChecked: language.value === selected,
      }))}
      size="small"
      onChange={onChange}
      compact
    />
  );
};
