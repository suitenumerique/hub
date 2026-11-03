import { Button, Tooltip } from "@gouvfr-lasuite/ui-components";
import { ArrowDown } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

type JumpToLatestButtonProps = {
  /** Messages from others arrived since the conversation was read. */
  hasNewMessages: boolean;
  onClick: () => void;
};

/**
 * Element's `JumpToBottomButton` (Figma node 3659:158397), floating over the
 * bottom of the timeline.
 */
export const JumpToLatestButton = ({
  hasNewMessages,
  onClick,
}: JumpToLatestButtonProps) => {
  const { t } = useTranslation();
  const label = hasNewMessages
    ? t("Scroll to new messages")
    : t("Scroll to most recent messages");

  return (
    <div className="hub__jump-to-latest" data-testid="jump-to-latest">
      <Tooltip content={label} placement="top" className="hub__delayed-tooltip">
        <Button
          type="button"
          size="nano"
          variant="tertiary"
          color="brand"
          aria-label={label}
          icon={<ArrowDown size={16} aria-hidden="true" />}
          onClick={onClick}
        />
      </Tooltip>
      {hasNewMessages && (
        <span className="hub__jump-to-latest__dot" aria-hidden="true" />
      )}
    </div>
  );
};
