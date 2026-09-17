// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewMeetingForm } from "../NewMeetingForm";

const notifyError = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}|${options.name}` : key,
  }),
}));

vi.mock("@/features/ui/components/toast", () => ({
  notify: { error: notifyError },
}));

const REFUSED = "Only .txt or .md files can be attached.";

const renderForm = () =>
  render(
    <NewMeetingForm
      isOpen
      isStarting={false}
      onClose={vi.fn()}
      onBack={vi.fn()}
      onStartNow={vi.fn()}
      onSchedule={vi.fn()}
    />,
  );

const pick = (testId: string, ...files: File[]) =>
  fireEvent.change(screen.getByTestId(testId), { target: { files } });

const text = (name: string) => new File(["contenu"], name);

describe("NewMeetingForm files", () => {
  let nextUrl = 0;
  const createObjectURL = vi.fn(() => `blob:file-${nextUrl++}`);
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    nextUrl = 0;
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("only offers .txt and .md files in both pickers", () => {
    renderForm();

    for (const testId of ["agenda-file-input", "document-file-input"]) {
      expect(screen.getByTestId(testId).getAttribute("accept")).toBe(
        ".txt,.md,text/plain,text/markdown",
      );
    }
  });

  it("attaches a markdown agenda with a download link", () => {
    renderForm();

    pick("agenda-file-input", text("ordre-du-jour.md"));

    const link = screen.getByLabelText("Download {{name}}|ordre-du-jour.md");
    expect(link.getAttribute("href")).toBe("blob:file-0");
    expect(link.getAttribute("download")).toBe("ordre-du-jour.md");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("refuses an agenda of another type", () => {
    renderForm();

    pick("agenda-file-input", text("ordre-du-jour.pdf"));

    expect(notifyError).toHaveBeenCalledWith(REFUSED);
    expect(screen.queryByText("ordre-du-jour.pdf")).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("releases the agenda file when it is replaced or removed", () => {
    renderForm();
    pick("agenda-file-input", text("v1.txt"));
    pick("agenda-file-input", text("v2.txt"));

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:file-0");
    expect(screen.queryByText("v1.txt")).toBeNull();

    fireEvent.click(screen.getByLabelText("Remove {{name}}|v2.txt"));

    expect(screen.queryByText("v2.txt")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:file-1");
  });

  it("attaches several document files and skips the others", () => {
    renderForm();

    pick(
      "document-file-input",
      text("support.md"),
      text("photo.png"),
      text("notes.txt"),
    );

    expect(screen.getByText("support.md")).toBeTruthy();
    expect(screen.getByText("notes.txt")).toBeTruthy();
    expect(screen.queryByText("photo.png")).toBeNull();
    expect(notifyError).toHaveBeenCalledWith(REFUSED);

    fireEvent.click(screen.getByLabelText("Remove {{name}}|support.md"));

    expect(screen.queryByText("support.md")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:file-0");
  });

  it("adds a document by link from the Docs button", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Add a Docs link" }));
    fireEvent.change(screen.getByLabelText("Document name"), {
      target: { value: "Compte rendu" },
    });
    fireEvent.change(screen.getByLabelText("Link"), {
      target: { value: "https://docs.example.org/docs/1/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const link = screen.getByLabelText("Download {{name}}|Compte rendu");
    expect(link.getAttribute("href")).toBe("https://docs.example.org/docs/1/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe("NewMeetingForm start and schedule", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderWithHandlers = () => {
    const onStartNow = vi.fn();
    const onSchedule = vi.fn();
    render(
      <NewMeetingForm
        isOpen
        isStarting={false}
        onClose={vi.fn()}
        onBack={vi.fn()}
        onStartNow={onStartNow}
        onSchedule={onSchedule}
      />,
    );
    return { onStartNow, onSchedule };
  };

  const pad = (value: number) => String(value).padStart(2, "0");

  it("starts the call now with its name and duration", () => {
    const { onStartNow } = renderWithHandlers();

    fireEvent.change(screen.getByLabelText("Meeting name"), {
      target: { value: "Point hebdo" },
    });
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start now" }));

    expect(onStartNow).toHaveBeenCalledWith({
      title: "Point hebdo",
      plannedDurationMinutes: 30,
    });
  });

  it("needs a date and a future time to schedule", () => {
    const { onSchedule } = renderWithHandlers();
    const schedule = screen.getByRole("button", { name: "Schedule" });

    expect(schedule.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Meeting date"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "10:00" },
    });

    expect(schedule.hasAttribute("disabled")).toBe(true);
    fireEvent.click(schedule);
    expect(onSchedule).not.toHaveBeenCalled();
  });

  it("schedules the meeting at the chosen local date and time", () => {
    const { onSchedule } = renderWithHandlers();
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    start.setHours(14, 30, 0, 0);
    const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;

    fireEvent.change(screen.getByLabelText("Meeting date"), {
      target: { value: date },
    });
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "14:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));

    expect(onSchedule).toHaveBeenCalledWith({
      title: undefined,
      plannedDurationMinutes: 60,
      startsAt: start,
    });
  });
});
