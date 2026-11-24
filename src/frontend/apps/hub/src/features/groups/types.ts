/** The two permission levels of a group (#34). */
export type GroupRole = "administrator" | "member";

/** Every role, the one a new member gets by default first. */
export const GROUP_ROLES: readonly GroupRole[] = ["member", "administrator"];

/**
 * The Hub's group (#30). Not `LocalChat.kind: "group"`, which only says that
 * a conversation is not a direct one.
 */
export type Group = {
  id: string;
  name: string;
  emoji: string;
  /** The current user's role in this group. */
  user_role: GroupRole;
  /** The group's conversation, once the backend has created it. */
  matrix: { room_id: string } | null;
};

/** A person, with the fields the UI kit's share modal shows. */
export type GroupUser = {
  /** Chat user id: the Matrix id (`@name:server`). */
  id: string;
  full_name: string;
  email: string;
};

/** A member of a group and their role. */
export type GroupAccess = {
  id: string;
  role: GroupRole;
  user: GroupUser;
};

export type CreateGroupPayload = {
  /** Chat account the group's conversation is created on. */
  matrix_account_id: string;
  name: string;
  emoji: string;
  /** Chat user ids, the current user excluded. */
  invitees: string[];
};

export type UpdateGroupPayload = {
  name: string;
  emoji: string;
};

export type AddGroupAccessesPayload = {
  user_ids: string[];
  role: GroupRole;
};

/**
 * A file or folder of Drive shared with a group. The fields that Drive has too
 * keep its names, so the backend can pass them on as they are.
 */
export type GroupFile = {
  /** Id of the item in Drive. */
  id: string;
  /** With its extension, which the list hides. */
  title: string;
  type: "file" | "folder";
  /** `null` for a folder. `lasuite/docs` for a Docs document. */
  mimetype: string | null;
  /** `public`: anyone with the link can open it. */
  computed_link_reach: "restricted" | "authenticated" | "public" | null;
  /** Page of the item in Drive (not its `url`, which downloads it). */
  drive_url: string;
};
