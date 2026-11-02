/**
 * How a Matrix user is presented in the chat UI: display name (without the
 * organization Tchap appends to it), initials and avatar colour. The colour hash is shared with the `Avatar` component through
 * the palette, so a person looks identical in search results, chips and message
 * bubbles. Kept free of React and of the SDK's `Room`/`MatrixEvent` types so the
 * mapping layer can depend on it without a cycle.
 */
import { deriveInitials } from "@/features/ui/components/avatar/initials";
import { hashAvatarColor } from "@/features/ui/components/avatar/palette";

import { ChatUser } from "../types";

/** A Matrix content URI, the only avatar reference the driver resolves. */
export const mxcUrl = (value: unknown): string | undefined =>
  typeof value === "string" && value.startsWith("mxc://") ? value : undefined;

/** Same initials as the `Avatar` component, so a person looks identical. */
export const initialsFor = (name: string): string =>
  deriveInitials(name) || "?";

/** The localpart of `@alice:server` → `alice`; a sensible fallback display name. */
const localpartOf = (userId: string): string =>
  userId.replace(/^@/, "").split(":")[0];

/**
 * Tchap appends the user's organization to the display name, as in
 * `Jean Dupont [Agriculture]`. The SDK may then add the Matrix id to tell apart
 * members sharing a display name: `Jean Dupont [Agriculture] (@jean:server)`.
 */
const ORGANIZATION_SUFFIX =
  /^(.*\S)\s*\[\s*([^[\]]*[^\s[\]])\s*\]( \(@[^\s()]+\))?$/;

/**
 * A display name split into the name people are shown and the organization
 * between its trailing brackets, when it has one. The Matrix id the SDK adds
 * stays on the name.
 */
export const splitDisplayName = (
  displayName: string,
): { name: string; organization?: string } => {
  const match = ORGANIZATION_SUFFIX.exec(displayName);
  return match
    ? { name: match[1] + (match[3] ?? ""), organization: match[2] }
    : { name: displayName };
};

/** A display name without its trailing organization. */
export const withoutOrganization = (displayName: string): string =>
  splitDisplayName(displayName).name;

/** One homeserver user-directory result, narrowed to the fields the UI needs. */
type MatrixDirectoryUser = {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
};

/**
 * A directory search result mapped to the New Chat people shape. The Matrix id
 * is the stable handle the whole flow keys on (search → chip → existing-chat
 * resolution), so it is the `ChatUser.id`; the same id fills `email` (the
 * directory carries no email, and the New Chat UI does not render it). The
 * organization of the display name is the secondary line, else that id.
 * Initials and colour come from this module's own helpers so a person looks
 * identical in search, chips and message bubbles.
 */
export const matrixDirectoryUserToChatUser = (
  user: MatrixDirectoryUser,
): ChatUser => {
  const { name, organization } = splitDisplayName(
    user.display_name?.trim() || localpartOf(user.user_id),
  );
  return {
    id: user.user_id,
    name,
    initials: initialsFor(name),
    color: hashAvatarColor(user.user_id),
    email: user.user_id,
    subtitle: organization ?? user.user_id,
    avatarUrl: mxcUrl(user.avatar_url),
  };
};
