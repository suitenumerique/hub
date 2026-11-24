import type { AccountId, Chat, ChatRef } from "@/features/drivers/types";

import type { Group, GroupAccess, GroupUser } from "./types";

/**
 * Two hard-coded groups in the conversation list, one per role, to try the
 * group screens before the backend exists. They have no Matrix room: their
 * conversation is empty (`DemoGroupView`). Delete this file once `HubApi`
 * returns real groups, with the imports TypeScript then reports.
 */
export const DEMO_GROUPS: Group[] = [
  {
    id: "demo-admin",
    name: "Groupe démo (admin)",
    emoji: "🌲",
    user_role: "administrator",
    matrix: { room_id: "demo-group-admin" },
  },
  {
    id: "demo-member",
    name: "Groupe démo (membre)",
    emoji: "🚀",
    user_role: "member",
    matrix: { room_id: "demo-group-member" },
  },
];

const demoUser = (id: string, full_name: string): GroupUser => ({
  id: `@${id}:demo`,
  full_name,
  email: `${id}@exemple.fr`,
});

export const DEMO_ACCESSES: GroupAccess[] = [
  {
    id: "demo-access-1",
    role: "administrator",
    user: demoUser("alice.martin", "Alice Martin"),
  },
  {
    id: "demo-access-2",
    role: "member",
    user: demoUser("bruno.petit", "Bruno Petit"),
  },
  {
    id: "demo-access-3",
    role: "member",
    user: demoUser("chloe.durand", "Chloé Durand"),
  },
];

/** The conversations of the demo groups, as the list shows them. */
export const demoGroupChats = (accountId: AccountId): Chat[] =>
  DEMO_GROUPS.flatMap(({ name, emoji, matrix }) =>
    matrix
      ? [
          {
            id: matrix.room_id,
            name,
            section: "all" as const,
            kind: "group" as const,
            participantIds: DEMO_ACCESSES.map((access) => access.user.id),
            visual: { kind: "emoji" as const, emoji },
            accountId,
            ref: { accountId, chatId: matrix.room_id },
          },
        ]
      : [],
  );

export const findDemoGroupChat = (ref: ChatRef | null): Chat | null =>
  (ref &&
    demoGroupChats(ref.accountId).find((chat) => chat.id === ref.chatId)) ??
  null;
