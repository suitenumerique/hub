import { fetchAPI } from "@/features/api/fetchApi";
import type { ChatMeetingDocument } from "@/features/drivers/types";

const meetingPath = (slug: string) => `meetings/${encodeURIComponent(slug)}/`;

/**
 * Keeps the Hub's copy of a meeting in step with a renaming or an extension:
 * the server closes the meeting from its planned end.
 */
export const updateMeeting = async (
  slug: string,
  change: { title?: string; extendMinutes?: number },
): Promise<void> => {
  await fetchAPI(
    meetingPath(slug),
    {
      method: "PATCH",
      body: JSON.stringify({
        ...(change.title !== undefined ? { title: change.title } : {}),
        ...(change.extendMinutes !== undefined
          ? { extend_minutes: change.extendMinutes }
          : {}),
      }),
    },
    { redirectOn40x: false },
  );
};

export type MeetingArchive = {
  blob: Blob;
  fileName: string;
};

/** The file name the server chose, from `Content-Disposition`. */
const fileNameOf = (response: Response, fallback: string): string => {
  const header = response.headers.get("Content-Disposition") ?? "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      // Fall back to the plain name.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
};

/**
 * Downloads the archive of a closed meeting. A member who is not its
 * organizer proves their Matrix account with `openIdToken`; `documents` are
 * the links the meeting state lists.
 */
export const fetchMeetingArchive = async (
  slug: string,
  {
    openIdToken,
    documents,
  }: { openIdToken?: string; documents: ChatMeetingDocument[] },
): Promise<MeetingArchive> => {
  const response = await fetchAPI(
    `${meetingPath(slug)}archive/`,
    {
      method: "POST",
      body: JSON.stringify({
        openid_token: openIdToken ?? "",
        // Only web links are listed in the archive.
        documents: documents
          .filter(({ url }) => /^https?:\/\//i.test(url))
          .map(({ title, url }) => ({ title, url })),
      }),
    },
    { redirectOn40x: false },
  );
  return {
    blob: await response.blob(),
    fileName: fileNameOf(response, `meeting-${slug}.zip`),
  };
};
