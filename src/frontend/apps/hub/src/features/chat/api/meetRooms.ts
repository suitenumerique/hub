import { fetchAPI } from "@/features/api/fetchApi";
import type { MeetRoom } from "@/features/drivers/types";

/**
 * Creates a Meet room owned by the current user. The Hub backend holds the
 * Meet application credentials and calls the Meet external API: they never
 * reach the browser.
 */
export const createMeetRoom = async (): Promise<MeetRoom> => {
  const response = await fetchAPI("meetings/", { method: "POST" });
  return (await response.json()) as MeetRoom;
};
