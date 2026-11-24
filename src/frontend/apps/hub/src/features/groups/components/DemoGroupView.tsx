import { useId, useRef, useState } from "react";

import { ChatHeader } from "@/features/chat/components/header/ChatHeader";
import {
  type ChatTool,
  ChatToolsPanel,
} from "@/features/chat/components/tools-panel/ChatToolsPanel";
import { ToolsPanelResizeHandle } from "@/features/chat/components/tools-panel/ToolsPanelResizeHandle";
import { useToolsPanelFits } from "@/features/chat/components/tools-panel/useToolsPanelFits";
import type { Chat } from "@/features/drivers/types";

import { useGroupForChat } from "../hooks/useGroups";

const DEMO_TOOLS: ChatTool[] = ["files"];
const ignore = () => {};

/**
 * A demo group's conversation: the real header (group menu, modals) and Drive
 * panel over an empty conversation, as it has no Matrix room. `ChatView` does
 * the same for a real one. Delete with `demoGroups.ts`.
 */
export const DemoGroupView = ({ chat }: { chat: Chat }) => {
  const group = useGroupForChat(chat);
  const [activeTool, setActiveTool] = useState<ChatTool | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const panelFits = useToolsPanelFits(viewRef);
  const isOpen = activeTool !== null;
  const closePanel = () => setActiveTool(null);

  return (
    <div
      ref={viewRef}
      className="hub__chat-view"
      data-panel-open={isOpen}
      data-panel-layout={panelFits ? "inline" : "overlay"}
      data-header-variant="chat"
    >
      <div className="hub__chat-view__header">
        <ChatHeader
          chat={chat}
          activeTool={activeTool}
          onToggleTool={(tool) =>
            setActiveTool((active) => (active === tool ? null : tool))
          }
          tools={DEMO_TOOLS}
        />
      </div>
      <div className="hub__chat-view__main">
        <div className="hub__chat-view__content" />
      </div>
      {!panelFits && (
        <div
          className="hub__chat-view__backdrop"
          aria-hidden="true"
          onClick={closePanel}
        />
      )}
      <div className="hub__chat-view__panel">
        {isOpen && panelFits && (
          <ToolsPanelResizeHandle viewRef={viewRef} panelId={panelId} />
        )}
        <ChatToolsPanel
          id={panelId}
          tool="files"
          isOpen={isOpen}
          chatRef={chat.ref}
          group={group}
          threadId={null}
          threadComposerFocusSignal={0}
          threadInitialMessage={null}
          draftThreadRoot={null}
          onClose={closePanel}
          onOpenThread={ignore}
          onCloseThread={ignore}
        />
      </div>
    </div>
  );
};
