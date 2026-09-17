import { fetchAPI } from "@/features/api/fetchApi";
import type {
  MeetingAttachment,
  MeetRoom,
  MeetRoomSchedule,
} from "@/features/drivers/types";

/** What the Hub keeps of a meeting: its closing and its archive rely on it. */
export type MeetRoomDetails = MeetRoomSchedule & {
  chatId: string;
  title?: string;
  agenda?: string;
  attachments?: MeetingAttachment[];
};

/** The browser's time zone: times in the archive follow it. */
const browserTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

/**
 * Creates a Meet room owned by the current user. The Hub backend holds the
 * Meet application credentials and calls the Meet external API: they never
 * reach the browser.
 */
export const createMeetRoom = async (
  details?: MeetRoomDetails,
): Promise<MeetRoom> => {
  const timeZone = browserTimeZone();
  const body = details && {
    chat_id: details.chatId,
    title: details.title ?? "",
    starts_at: details.startsAt.toISOString(),
    planned_end_at: details.plannedEndAt?.toISOString() ?? null,
    agenda: details.agenda ?? "",
    attachments: details.attachments ?? [],
    ...(timeZone ? { time_zone: timeZone } : {}),
  };
  const response = await fetchAPI("meetings/", {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return (await response.json()) as MeetRoom;
};
