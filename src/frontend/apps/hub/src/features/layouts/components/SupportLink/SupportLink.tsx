import { Button, type ButtonProps } from "@gouvfr-lasuite/ui-components";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FEEDBACK_FORM_URL } from "@/features/config/feedbackForm";

type SupportLinkProps = Pick<ButtonProps, "size" | "icon" | "variant"> & {
  children: ReactNode;
};

/** Asks for help before the chat opens, with the feedback form for now. */
export const SupportLink = ({
  children,
  size,
  icon,
  variant = "tertiary",
}: SupportLinkProps) => {
  const { t } = useTranslation();

  return (
    <Button
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      color="neutral"
      size={size}
      icon={icon}
    >
      {children}
      <span className="hub__visually-hidden">
        {" "}
        {t("(new window)", {
          description: "Read after a link that opens in a new tab",
        })}
      </span>
    </Button>
  );
};
