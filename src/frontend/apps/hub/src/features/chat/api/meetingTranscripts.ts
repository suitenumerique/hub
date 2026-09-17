import { APIError } from "@/features/api/APIError";
import { fetchAPI } from "@/features/api/fetchApi";
import type { ChatMeetingDocument } from "@/features/drivers/types";

/**
 * Closes a meeting for the scribe and saves what was said in a Docs document
 * owned by the current user, its organizer. Resolves to `null` when there is
 * nothing to save: nothing was transcribed, the meeting was not created by
 * this Hub, or the Hub has no Docs configured.
 */
export const saveMeetingTranscript = async (
  slug: string,
  title: string,
): Promise<ChatMeetingDocument | null> => {
  try {
    const response = await fetchAPI(
      `meetings/${encodeURIComponent(slug)}/transcript/`,
      { method: "POST", body: JSON.stringify({ title }) },
      { redirectOn40x: false },
    );
    if (response.status === 204) {
      return null;
    }
    return (await response.json()) as ChatMeetingDocument;
  } catch (error) {
    if (
      error instanceof APIError &&
      (error.code === 404 || error.code === 503)
    ) {
      return null;
    }
    throw error;
  }
};
