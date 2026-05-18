import { ChevronDown } from "@gouvfr-lasuite/ui-kit/icons";
import { ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

type SectionTitleProps = {
  title: string;
};

const SectionTitle = ({ title }: SectionTitleProps) => (
  <span className="hub__chat-tools-panel__section__title">{title}</span>
);

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  variant?: "default" | "pinned";
  children: ReactNode;
};

export const CollapsibleSection = ({
  title,
  defaultOpen = true,
  variant = "default",
  children,
}: CollapsibleSectionProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bodyId = useId();

  const sectionClassName =
    variant === "pinned"
      ? "hub__chat-tools-panel__section hub__chat-tools-panel__section--pinned"
      : "hub__chat-tools-panel__section";

  return (
    <section className={sectionClassName} data-open={isOpen || undefined}>
      <button
        type="button"
        className="hub__chat-tools-panel__section__header"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        aria-label={isOpen ? t("Collapse section") : t("Expand section")}
        onClick={() => setIsOpen((current) => !current)}
      >
        <SectionTitle title={title} />
        <span
          className="hub__chat-tools-panel__section__toggle"
          aria-hidden="true"
          data-open={isOpen || undefined}
        >
          <ChevronDown />
        </span>
      </button>
      {isOpen && (
        <div id={bodyId} className="hub__chat-tools-panel__section__body">
          {children}
        </div>
      )}
    </section>
  );
};

type PinnedSectionProps = {
  title: string;
  children: ReactNode;
};

export const PinnedSection = ({ title, children }: PinnedSectionProps) => (
  <CollapsibleSection title={title} variant="pinned">
    {children}
  </CollapsibleSection>
);
