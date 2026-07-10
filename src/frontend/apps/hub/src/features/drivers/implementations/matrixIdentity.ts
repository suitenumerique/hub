/**
 * How a Matrix user is presented in the chat UI: display name, initials and
 * avatar colour. The colour hash is shared with the `Avatar` component through
 * the palette, so a person looks identical in search results, chips and message
 * bubbles. Kept free of React and of the SDK's `Room`/`MatrixEvent` types so the
 * mapping layer can depend on it without a cycle.
 */
import { hashAvatarColor } from "@/features/ui/components/avatar/palette";

import { ChatUser } from "../types";

export const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || "?";
};

/** The localpart of `@alice:server` → `alice`; a sensible fallback display name. */
const localpartOf = (userId: string): string =>
  userId.replace(/^@/, "").split(":")[0];

/** One homeserver user-directory result, narrowed to the fields the UI needs. */
type MatrixDirectoryUser = { user_id: string; display_name?: string };

/**
 * A directory search result mapped to the New Chat people shape. The Matrix id
 * is the stable handle the whole flow keys on (search → chip → existing-chat
 * resolution), so it is the `ChatUser.id`; the same id is the secondary line and
 * fills `email` (the directory carries no email, and the New Chat UI does not
 * render it). Initials and colour come from this module's own helpers so a
 * person looks identical in search, chips and message bubbles.
 */
export const matrixDirectoryUserToChatUser = (
  user: MatrixDirectoryUser,
): ChatUser => {
  const name = user.display_name?.trim() || localpartOf(user.user_id);
  return {
    id: user.user_id,
    name,
    initials: initialsFor(name),
    color: hashAvatarColor(user.user_id),
    email: user.user_id,
    subtitle: user.user_id,
  };
};
