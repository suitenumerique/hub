import { Button } from "@gouvfr-lasuite/ui-components";
import { Meet } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import { useChatMeetings } from "@/features/chat/hooks/useChatMeetings";
import { useNow } from "@/features/chat/meetings/useNow";
import { isMeetingOngoing } from "@/features/drivers/meetingTime";
import type { ChatRef } from "@/features/drivers/types";

type MeetingButtonProps = {
  /** `null` while the conversation is still being fetched — the button stays
   * disabled until it resolves. */
  chatRef: ChatRef | null;
  isActive: boolean;
  onToggle: () => void;
};

/**
 * Camera button of the conversation header. It opens the meetings panel rather
 * than placing the call: the call is started from "Start now" inside that
 * panel, so planning a meeting and joining one share the same entry point. The
 * button stays highlighted while a meeting is ongoing in the conversation.
 */
export const MeetingButton = ({
  chatRef,
  isActive,
  onToggle,
}: MeetingButtonProps) => {
  const { t } = useTranslation();
  const { meetings } = useChatMeetings(chatRef, true);
  const now = useNow();

  const hasOngoingMeeting = meetings.some((meeting) =>
    isMeetingOngoing(meeting, now),
  );

  return (
    <Button
      type="button"
      variant="tertiary"
      color="neutral"
      size="small"
      className="hub__chat-header__icon-button"
      aria-label={t("Meetings")}
      aria-pressed={isActive}
      data-active={isActive || hasOngoingMeeting}
      active={isActive}
      disabled={!chatRef}
      icon={<Meet />}
      onClick={onToggle}
    />
  );
};
