import { useTranslation } from "react-i18next";

import type { ChatRef } from "@/features/drivers/types";

import { ChatEncryptionNotice } from "./ChatEncryptionNotice";

export type TimelineContext = {
  chatRef: ChatRef;
  hasOlder: boolean;
  isFetchingOlder: boolean;
};

// Keep the header component stable across pagination updates; changing values
// arrive through Virtuoso's context rather than recreating the component type.
export const TimelineHeader = ({ context }: { context?: TimelineContext }) => {
  const { t } = useTranslation();
  if (!context) return null;
  return (
    <>
      <div className="hub__chat-conversation__top-spacer">
        {context.isFetchingOlder && (
          <div className="hub__chat-conversation__top-loader" role="status">
            <span className="material-icons" aria-hidden="true">
              sync
            </span>
            {t("Loading older messages…")}
          </div>
        )}
      </div>
      {/* Show the notice at the start of available history, not every page. */}
      {!context.hasOlder && (
        <div className="hub__chat-conversation__row">
          <div className="hub__chat-conversation__row-inner">
            <ChatEncryptionNotice chatRef={context.chatRef} />
          </div>
        </div>
      )}
    </>
  );
};
