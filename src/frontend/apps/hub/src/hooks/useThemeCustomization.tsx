import { useTranslation } from "react-i18next";

import { useConfig } from "@/features/config/ConfigProvider";
import { ThemeCustomization } from "@/features/drivers/types";

export const useThemeCustomization = (key: keyof ThemeCustomization) => {
  const { config } = useConfig();
  const { i18n } = useTranslation();
  const language = (i18n.language || "en").slice(0, 2).toLowerCase();
  const themeCustomization = config?.theme_customization?.[key];
  return {
    ...themeCustomization?.default,
    ...(themeCustomization?.[language as keyof typeof themeCustomization] ??
      {}),
  };
};
