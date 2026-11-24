import { ChatHeader } from "@/features/chat/components/header/ChatHeader";
import type { Chat } from "@/features/drivers/types";

const ignoreTool = () => {};

/**
 * A demo group's conversation: the real header (group menu, modals) over an
 * empty conversation, as it has no Matrix room. Delete with `demoGroups.ts`.
 */
export const DemoGroupView = ({ chat }: { chat: Chat }) => (
  <div className="hub__chat-view" data-header-variant="chat">
    <div className="hub__chat-view__header">
      <ChatHeader
        chat={chat}
        activeTool={null}
        onToggleTool={ignoreTool}
        showTools={false}
      />
    </div>
    <div className="hub__chat-view__main">
      <div className="hub__chat-view__content" />
    </div>
  </div>
);
