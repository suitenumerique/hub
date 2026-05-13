import { LaGaufreV2 } from "@gouvfr-lasuite/ui-kit";

import { useConfig } from "@/features/config/ConfigProvider";

import cunningham from "@cunningham";

// Cunningham emits theme tokens as CSS-style quoted strings ("'value'"). The
// LaGaufreV2 component expects bare strings.
const stripQuotes = (value: string) => value.replace(/^['"]|['"]$/g, "");

export const Gaufre = () => {
  const { config } = useConfig();
  if (config?.FRONTEND_HIDE_GAUFRE) {
    return null;
  }

  const gaufre = cunningham.themes["dsfr-light"].components.gaufre;
  return (
    <LaGaufreV2
      widgetPath={stripQuotes(gaufre.widgetPath)}
      apiUrl={stripQuotes(gaufre.apiUrl)}
    />
  );
};
