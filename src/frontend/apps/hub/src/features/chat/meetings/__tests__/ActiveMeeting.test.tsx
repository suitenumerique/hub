// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMeeting, ChatRef } from "@/features/drivers/types";

import { ActiveMeetingProvider, useActiveMeeting } from "../ActiveMeeting";

const SELF_ID = "@me:localhost";
const OTHER_ID = "@alice:localhost";
const URL_A = "https://meet.example.com/abc-defg-hij";
const URL_B = "https://meet.example.com/klm-nopq-rst";
const CHAT_REF: ChatRef = { accountId: "matrix", chatId: "!room:localhost" };

const BOARD_URL = "https://board.example.com/#room=abc,key";

const state = vi.hoisted(() => ({
  meetings: [] as ChatMeeting[],
  boardUrl: null as string | null,
}));
const endMeeting = vi.hoisted(() => vi.fn(async () => undefined));
const extendMeeting = vi.hoisted(() => vi.fn(async () => undefined));
const renameMeeting = vi.hoisted(() => vi.fn(async () => undefined));
const notifyBrand = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/features/auth/Auth", () => ({
  useAuth: () => ({ chatUser: { userId: SELF_ID } }),
}));
vi.mock("@/features/chat/hooks/useChatMeetings", () => ({
  useChatMeetings: () => ({
    meetings: state.meetings,
    isSupported: true,
    isInitialLoading: false,
  }),
}));
vi.mock("@/features/chat/hooks/useChatMeetingActions", () => ({
  useChatMeetingActions: () => ({
    endMeeting,
    extendMeeting,
    renameMeeting,
    isPending: false,
  }),
}));
// The board URL derivation needs Web Crypto, which jsdom does not provide;
// it has its own unit test.
vi.mock("../meetingBoard", () => ({
  useMeetingBoardUrl: () => state.boardUrl,
}));
vi.mock("@/features/ui/components/toast", () => ({
  notify: { brand: notifyBrand, error: vi.fn() },
}));

const meetingA = (overrides: Partial<ChatMeeting> = {}): ChatMeeting => ({
  id: "abc-defg-hij",
  url: URL_A,
  organizerId: SELF_ID,
  title: "Point hebdo",
  startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  plannedDurationMinutes: 30,
  documents: [],
  ...overrides,
});

const Opener = () => {
  const { openMeeting, isMinimized } = useActiveMeeting();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          openMeeting({
            url: URL_A,
            meetingId: "abc-defg-hij",
            chatRef: CHAT_REF,
          })
        }
      >
        open A
      </button>
      <button type="button" onClick={() => openMeeting({ url: URL_B })}>
        open B
      </button>
      <span data-testid="state">{isMinimized ? "minimized" : "expanded"}</span>
    </>
  );
};

const app = () => (
  <ActiveMeetingProvider>
    <Opener />
  </ActiveMeetingProvider>
);

const frame = () => screen.getByTitle("Meeting") as HTMLIFrameElement;
const dialog = () => screen.getByRole("dialog");

describe("ActiveMeetingProvider", () => {
  beforeEach(() => {
    state.meetings = [meetingA()];
    state.boardUrl = null;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows no window until a meeting is opened", () => {
    render(app());

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the same frame when minimized and restored", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));
    const before = frame();
    expect(before.getAttribute("src")).toBe(URL_A);

    fireEvent.click(screen.getByLabelText("Minimize the meeting"));

    expect(dialog().hasAttribute("data-minimized")).toBe(true);
    expect(screen.queryByTestId("meeting-window-backdrop")).toBeNull();
    expect(screen.getByTestId("state").textContent).toBe("minimized");
    expect(frame()).toBe(before);

    fireEvent.click(screen.getByLabelText("Restore the meeting"));

    expect(dialog().hasAttribute("data-minimized")).toBe(false);
    expect(frame()).toBe(before);
  });

  it("minimizes when the backdrop is clicked", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));

    fireEvent.click(screen.getByTestId("meeting-window-backdrop"));

    expect(dialog().hasAttribute("data-minimized")).toBe(true);
  });

  it("leaves the call", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));

    fireEvent.click(screen.getByLabelText("Leave the meeting"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the embedded call when it is opened in a new tab", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));
    const link = screen.getByLabelText("Open in a new tab");
    expect(link.getAttribute("href")).toBe(URL_A);

    fireEvent.click(link);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("switches to another call expanded", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));
    fireEvent.click(screen.getByLabelText("Minimize the meeting"));

    fireEvent.click(screen.getByText("open B"));

    expect(frame().getAttribute("src")).toBe(URL_B);
    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });

  it("shows the progress and the title of the meeting", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));

    expect(screen.getByText("Point hebdo")).toBeTruthy();
    const progress = screen.getByTestId("meeting-progress");
    expect(progress.textContent).toBe("10 min / 30 min");
    expect(progress.hasAttribute("data-overdue")).toBe(false);
  });

  it("flags a meeting past its planned duration", () => {
    state.meetings = [meetingA({ plannedDurationMinutes: 5 })];
    render(app());
    fireEvent.click(screen.getByText("open A"));

    const progress = screen.getByTestId("meeting-progress");
    expect(progress.textContent).toBe("10 min / 5 min · Overtime");
    expect(progress.hasAttribute("data-overdue")).toBe(true);
  });

  it("offers no whiteboard when the deployment configures none", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));

    expect(screen.queryByLabelText("Show the whiteboard")).toBeNull();
    expect(screen.queryByTestId("meeting-board")).toBeNull();
  });

  it("shows the whiteboard next to the call, without touching the call", () => {
    state.boardUrl = BOARD_URL;
    render(app());
    fireEvent.click(screen.getByText("open A"));
    const call = frame();

    fireEvent.click(screen.getByLabelText("Show the whiteboard"));

    const board = screen.getByTestId("meeting-board") as HTMLIFrameElement;
    expect(board.getAttribute("src")).toBe(BOARD_URL);
    expect(board.hidden).toBe(false);
    // The call must survive the split: a remounted frame would drop the user.
    expect(frame()).toBe(call);
  });

  it("keeps the whiteboard mounted when it is hidden again", () => {
    state.boardUrl = BOARD_URL;
    render(app());
    fireEvent.click(screen.getByText("open A"));
    fireEvent.click(screen.getByLabelText("Show the whiteboard"));
    const board = screen.getByTestId("meeting-board") as HTMLIFrameElement;

    fireEvent.click(screen.getByLabelText("Hide the whiteboard"));

    expect(screen.getByTestId("meeting-board")).toBe(board);
    expect(board.hidden).toBe(true);
  });

  it("hides the whiteboard while the window is minimized", () => {
    state.boardUrl = BOARD_URL;
    render(app());
    fireEvent.click(screen.getByText("open A"));
    fireEvent.click(screen.getByLabelText("Show the whiteboard"));

    fireEvent.click(screen.getByLabelText("Minimize the meeting"));

    const board = screen.getByTestId("meeting-board") as HTMLIFrameElement;
    expect(screen.queryByLabelText("Hide the whiteboard")).toBeNull();
    expect(board.hidden).toBe(true);
  });

  it("lets the organizer extend and close the meeting", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));

    fireEvent.click(screen.getByText("+15 min"));
    fireEvent.click(screen.getByText("Close the meeting"));

    expect(extendMeeting).toHaveBeenCalledWith("abc-defg-hij", 15);
    expect(endMeeting).toHaveBeenCalledWith("abc-defg-hij", "Point hebdo");
  });

  it("lets the organizer rename the meeting", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));

    fireEvent.click(screen.getByLabelText("Rename the meeting"));
    const input = screen.getByLabelText("Meeting name") as HTMLInputElement;
    expect(input.value).toBe("Point hebdo");
    fireEvent.change(input, { target: { value: " Rétro " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(renameMeeting).toHaveBeenCalledWith("abc-defg-hij", "Rétro");
    expect(screen.queryByLabelText("Meeting name")).toBeNull();
  });

  it("cancels the renaming with Escape", () => {
    render(app());
    fireEvent.click(screen.getByText("open A"));

    fireEvent.click(screen.getByLabelText("Rename the meeting"));
    const input = screen.getByLabelText("Meeting name");
    fireEvent.change(input, { target: { value: "Autre" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(renameMeeting).not.toHaveBeenCalled();
    expect(screen.getByText("Point hebdo")).toBeTruthy();
  });

  it("hides the organizer actions from the other participants", () => {
    state.meetings = [meetingA({ organizerId: OTHER_ID })];
    render(app());
    fireEvent.click(screen.getByText("open A"));

    expect(screen.queryByLabelText("Rename the meeting")).toBeNull();
    expect(screen.queryByText("+15 min")).toBeNull();
    expect(screen.queryByText("Close the meeting")).toBeNull();
  });

  it("tells everyone when the meeting closed on its own", () => {
    const { rerender } = render(app());
    fireEvent.click(screen.getByText("open A"));

    state.meetings = [
      meetingA({ endedAt: new Date().toISOString(), endedBy: "auto" }),
    ];
    act(() => rerender(app()));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(notifyBrand).toHaveBeenCalledWith(
      "The meeting was closed automatically.",
    );
  });

  it("closes the window when the organizer closes the meeting", () => {
    state.meetings = [meetingA({ organizerId: OTHER_ID })];
    const { rerender } = render(app());
    fireEvent.click(screen.getByText("open A"));
    expect(dialog()).toBeTruthy();

    state.meetings = [
      meetingA({ organizerId: OTHER_ID, endedAt: new Date().toISOString() }),
    ];
    act(() => rerender(app()));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(notifyBrand).toHaveBeenCalledWith(
      "The meeting was closed by its organizer.",
    );
  });
});
