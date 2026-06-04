// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n/initI18n";
import { notify } from "@/features/ui/components/toast";

import { ChatComposer } from "../ChatComposer";

vi.mock("@/features/ui/components/toast", () => ({
  notify: { error: vi.fn() },
}));

describe("ChatComposer", () => {
  beforeEach(() => {
    vi.mocked(notify.error).mockClear();
  });

  it("does not submit an empty draft", () => {
    const onSubmit = vi.fn();
    render(<ChatComposer onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed draft and clears after success", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChatComposer onSubmit={onSubmit} />);

    const input = screen.getByLabelText("Message") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Hello team  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("Hello team");
      expect(input.value).toBe("");
    });
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("surfaces an error toast and keeps the draft when submission fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    render(<ChatComposer onSubmit={onSubmit} />);

    const input = screen.getByLabelText("Message") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Please keep me" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("Please keep me");
      expect(notify.error).toHaveBeenCalledTimes(1);
    });
    expect(input.value).toBe("Please keep me");
  });

  it("uses the contextual errorMessage in the toast when provided", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <ChatComposer
        errorMessage="The reply could not be sent."
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Reply text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith("The reply could not be sent.");
    });
  });

  it("prevents duplicate submissions while one is pending", async () => {
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(() => {
          // Keep the promise pending.
        }),
    );
    render(<ChatComposer onSubmit={onSubmit} />);

    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value: "Only once" } });
    const send = screen.getByRole("button", { name: "Send message" });

    fireEvent.click(send);
    fireEvent.click(send);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(send.getAttribute("disabled")).not.toBeNull();
    });
  });

  it("focuses the input when autoFocus is enabled", async () => {
    render(<ChatComposer autoFocus onSubmit={vi.fn()} />);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Message"));
    });
  });

  it("clears the draft when switching to another concrete conversation", () => {
    const { rerender } = render(
      <ChatComposer conversationId="account-a:chat-1" onSubmit={vi.fn()} />,
    );

    const input = screen.getByLabelText("Message") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Meant for chat 1" } });
    expect(input.value).toBe("Meant for chat 1");

    rerender(
      <ChatComposer conversationId="account-a:chat-2" onSubmit={vi.fn()} />,
    );

    expect(input.value).toBe("");
  });

  it("keeps the draft when the conversation resolves from undefined to a value", () => {
    const { rerender } = render(
      <ChatComposer conversationId={undefined} onSubmit={vi.fn()} />,
    );

    const input = screen.getByLabelText("Message") as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "First message of a new chat" },
    });

    // The new-chat → resolved-chat handoff must not wipe the in-progress draft.
    rerender(
      <ChatComposer conversationId="account-a:new-chat" onSubmit={vi.fn()} />,
    );

    expect(input.value).toBe("First message of a new chat");
  });
});
