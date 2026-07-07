// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import type { Chat, ChatRef, LocalChat } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { ChatInvitationView } from "../ChatInvitationView";

const push = vi.fn();
vi.mock("next/router", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/features/ui/components/toast", () => ({
  notify: { error: vi.fn() },
}));

const acceptChatInvitation = vi.fn();
const refuseChatInvitation = vi.fn();
vi.mock("@/features/drivers/DriverRegistry", () => ({
  getRegistry: () => ({
    get: () => ({ acceptChatInvitation, refuseChatInvitation }),
  }),
}));

const CHAT_REF: ChatRef = { accountId: "matrix-local", chatId: "!room:localhost" };
const INVITE_CHAT: Chat = {
  id: CHAT_REF.chatId,
  accountId: CHAT_REF.accountId,
  ref: CHAT_REF,
  name: "Project invite",
  section: "all",
  kind: "group",
  participantIds: ["@bob:localhost"],
  visual: { kind: "icon", icon: "mail" },
  membership: "invite",
  invitation: {
    inviterId: "@bob:localhost",
    inviterName: "Bob Dubois",
    reason: "Join the project room",
    invitedAt: "2026-06-01T10:00:00.000Z",
  },
};

const JOINED_CHAT: LocalChat = {
  id: CHAT_REF.chatId,
  name: "Project invite",
  section: "all",
  kind: "group",
  participantIds: ["@bob:localhost"],
  visual: { kind: "icon", icon: "groups" },
  membership: "join",
};

const renderView = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ChatInvitationView chatRef={CHAT_REF} chat={INVITE_CHAT} />, {
    wrapper: Wrapper,
  });
};

describe("ChatInvitationView", () => {
  beforeEach(() => {
    push.mockClear();
    acceptChatInvitation.mockReset();
    refuseChatInvitation.mockReset();
    vi.mocked(notify.error).mockClear();
  });

  it("renders the invitation detail: name, inviter, and reason", () => {
    renderView();

    expect(screen.getByText("Project invite")).toBeTruthy();
    expect(screen.getByText("Bob Dubois")).toBeTruthy();
    expect(screen.getByText("Join the project room")).toBeTruthy();
  });

  it("accepts through the driver and keeps the current route", async () => {
    acceptChatInvitation.mockResolvedValue(JOINED_CHAT);
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(acceptChatInvitation).toHaveBeenCalledWith(CHAT_REF.chatId);
    });
    expect(push).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("surfaces a toast and stays on the invitation when accept fails", async () => {
    acceptChatInvitation.mockRejectedValue(new Error("join failed"));
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledTimes(1);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("refuses through the driver and navigates to /chat/new", async () => {
    refuseChatInvitation.mockResolvedValue(undefined);
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Refuse" }));

    await waitFor(() => {
      expect(refuseChatInvitation).toHaveBeenCalledWith(CHAT_REF.chatId);
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/chat/new");
    });
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("surfaces a toast and stays on the invitation when refuse fails", async () => {
    refuseChatInvitation.mockRejectedValue(new Error("leave failed"));
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Refuse" }));

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledTimes(1);
    });
    expect(push).not.toHaveBeenCalled();
  });
});
