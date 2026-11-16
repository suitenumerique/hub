import {
  Button,
  DropdownMenu,
  useDropdownMenu,
} from "@gouvfr-lasuite/ui-components";
import { ArrowDropDown } from "@gouvfr-lasuite/ui-components/icons";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { type ThemePreference, useTheme } from "@/features/theme/useTheme";

const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];

export const GeneralSettings = () => {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();
  const menu = useDropdownMenu();
  const id = useId();
  const labels: Record<ThemePreference, string> = {
    system: t("Use system settings"),
    light: t("Light", { description: "Theme option in the settings" }),
    dark: t("Dark", { description: "Theme option in the settings" }),
  };
  return (
    <div className="hub__settings-row">
      <div className="hub__settings-row__text">
        <span id={`${id}-label`} className="hub__settings-row__label">
          {t("Appearance")}
        </span>
        <span
          id={`${id}-description`}
          className="hub__settings-row__description"
        >
          {t("Customize how the app looks on this device.")}
        </span>
      </div>
      <DropdownMenu
        isOpen={menu.isOpen}
        onOpenChange={menu.setIsOpen}
        variant="tiny"
        options={THEME_PREFERENCES.map((value) => ({
          value,
          label: labels[value],
        }))}
        selectedValues={[preference]}
        onSelectValue={(selected) => {
          const value = THEME_PREFERENCES.find(
            (candidate) => candidate === selected,
          );
          if (value) setPreference(value);
        }}
      >
        <Button
          id={`${id}-value`}
          type="button"
          variant="tertiary"
          color="brand"
          size="small"
          icon={<ArrowDropDown aria-hidden="true" />}
          iconPosition="right"
          className="hub__settings-row__value"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={`${id}-description`}
          aria-haspopup="menu"
          aria-expanded={menu.isOpen}
          onClick={() => menu.setIsOpen(!menu.isOpen)}
        >
          {labels[preference]}
        </Button>
      </DropdownMenu>
    </div>
  );
};
