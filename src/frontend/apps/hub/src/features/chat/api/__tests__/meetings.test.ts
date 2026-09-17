import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMeetingArchive, updateMeeting } from "../meetings";

const fetchAPI = vi.hoisted(() => vi.fn());

vi.mock("@/features/api/fetchApi", () => ({ fetchAPI }));

describe("updateMeeting", () => {
  afterEach(() => {
    fetchAPI.mockReset();
  });

  it("sends only what changed", async () => {
    fetchAPI.mockResolvedValue(new Response(null, { status: 204 }));

    await updateMeeting("abc-defg-hij", { extendMinutes: 15 });
    await updateMeeting("abc-defg-hij", { title: "" });

    expect(fetchAPI).toHaveBeenNthCalledWith(
      1,
      "meetings/abc-defg-hij/",
      { method: "PATCH", body: JSON.stringify({ extend_minutes: 15 }) },
      { redirectOn40x: false },
    );
    expect(fetchAPI.mock.calls[1][1].body).toBe(JSON.stringify({ title: "" }));
  });
});

describe("fetchMeetingArchive", () => {
  afterEach(() => {
    fetchAPI.mockReset();
  });

  const archive = (disposition?: string) =>
    new Response(new Blob(["zip"]), {
      status: 200,
      headers: disposition ? { "Content-Disposition": disposition } : {},
    });

  it("proves the account and lists only web links", async () => {
    fetchAPI.mockResolvedValue(
      archive('attachment; filename="reunion-2026-09-17-Point.zip"'),
    );

    const result = await fetchMeetingArchive("abc-defg-hij", {
      openIdToken: "openid",
      documents: [
        { id: "a", title: "Compte rendu", url: "https://docs.test/docs/1/" },
        { id: "b", title: "Fichier local", url: "blob:http://hub/123" },
      ],
    });

    expect(result.fileName).toBe("reunion-2026-09-17-Point.zip");
    expect(await result.blob.text()).toBe("zip");
    const [path, init, options] = fetchAPI.mock.calls[0];
    expect(path).toBe("meetings/abc-defg-hij/archive/");
    expect(options).toEqual({ redirectOn40x: false });
    expect(JSON.parse(init.body)).toEqual({
      openid_token: "openid",
      documents: [{ title: "Compte rendu", url: "https://docs.test/docs/1/" }],
    });
  });

  it("reads an encoded file name, or falls back to the meeting", async () => {
    fetchAPI.mockResolvedValueOnce(
      archive(
        "attachment; filename=\"r.zip\"; filename*=UTF-8''r%C3%A9union.zip",
      ),
    );
    fetchAPI.mockResolvedValueOnce(archive());

    const encoded = await fetchMeetingArchive("s", { documents: [] });
    const fallback = await fetchMeetingArchive("s", { documents: [] });

    expect(encoded.fileName).toBe("réunion.zip");
    expect(fallback.fileName).toBe("meeting-s.zip");
  });
});
