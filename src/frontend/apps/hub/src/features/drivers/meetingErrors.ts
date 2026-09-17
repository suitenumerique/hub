/**
 * The current user may not record a meeting in this conversation (in Matrix,
 * their power level is below the one the meeting state event requires).
 * Raised before any Meet room is created.
 */
export class MeetingNotAllowedError extends Error {
  constructor(chatId: string) {
    super(`Starting a meeting is not allowed in conversation "${chatId}".`);
    this.name = "MeetingNotAllowedError";
  }
}
