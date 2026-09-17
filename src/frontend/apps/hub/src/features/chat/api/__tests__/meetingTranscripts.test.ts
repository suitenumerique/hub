import { afterEach, describe, expect, it, vi } from "vitest";

import { APIError } from "@/features/api/APIError";

import { saveMeetingTranscript } from "../meetingTranscripts";

const fetchAPI = vi.hoisted(() => vi.fn());

vi.mock("@/features/api/fetchApi", () => ({ fetchAPI }));

const DOCUMENT = {
  id: "doc-123",
  title: "Transcript: Point hebdo",
  url: "https://docs.example.com/docs/doc-123/",
};

describe("saveMeetingTranscript", () => {
  afterEach(() => {
    fetchAPI.mockReset();
  });

  it("posts the meeting name and answers the document", async () => {
    fetchAPI.mockResolvedValue(
      new Response(JSON.stringify(DOCUMENT), { status: 201 }),
    );

    await expect(
      saveMeetingTranscript("abc-defg-hij", "Point hebdo"),
    ).resolves.toEqual(DOCUMENT);

    expect(fetchAPI).toHaveBeenCalledWith(
      "meetings/abc-defg-hij/transcript/",
      { method: "POST", body: JSON.stringify({ title: "Point hebdo" }) },
      { redirectOn40x: false },
    );
  });

  it("answers null when nothing was transcribed", async () => {
    fetchAPI.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      saveMeetingTranscript("abc-defg-hij", "Point hebdo"),
    ).resolves.toBeNull();
  });

  it.each([404, 503])("answers null on %d", async (code) => {
    fetchAPI.mockRejectedValue(new APIError(code));

    await expect(
      saveMeetingTranscript("abc-defg-hij", "Point hebdo"),
    ).resolves.toBeNull();
  });

  it("fails when Docs refuses the transcript", async () => {
    fetchAPI.mockRejectedValue(new APIError(502));

    await expect(
      saveMeetingTranscript("abc-defg-hij", "Point hebdo"),
    ).rejects.toBeInstanceOf(APIError);
  });
});
