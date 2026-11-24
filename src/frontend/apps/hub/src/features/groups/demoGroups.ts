import type { AccountId, Chat, ChatRef } from "@/features/drivers/types";

import type { Group, GroupAccess, GroupFile, GroupUser } from "./types";

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

const demoFile = (
  title: string,
  mimetype: string | null,
  reach: GroupFile["computed_link_reach"] = "restricted",
): GroupFile => ({
  id: title,
  title,
  type: mimetype === null ? "folder" : "file",
  mimetype,
  computed_link_reach: reach,
  // Drive's home page: these files do not exist there.
  drive_url: "https://fichiers.numerique.gouv.fr/",
});

const OFFICE = "application/vnd.openxmlformats-officedocument";

/** Every icon of the UI kit, but the suspicious file and restricted folder. */
export const DEMO_FILES: GroupFile[] = [
  demoFile("Communication", null),
  demoFile("Photos du séminaire", null, "public"),
  demoFile("Compte rendu hebdomadaire", "lasuite/docs"),
  demoFile("Note de cadrage.docx", `${OFFICE}.wordprocessingml.document`),
  demoFile("Budget 2027.xlsx", `${OFFICE}.spreadsheetml.sheet`),
  demoFile(
    "Présentation Monet.pptx",
    `${OFFICE}.presentationml.presentation`,
    "public",
  ),
  demoFile("Convention signée.pdf", "application/pdf"),
  demoFile("Fond d’écran fleurs.png", "image/png", "public"),
  demoFile("Interview.mp3", "audio/mpeg"),
  demoFile("Visite des locaux.mp4", "video/mp4"),
  demoFile("Archives 2026.zip", "application/zip"),
  demoFile("Suivi des demandes.grist", "application/vnd.sqlite3"),
  demoFile("Référentiel.sqlite", "application/x-sqlite3"),
  demoFile("Logistique du séminaire.txt", "text/plain"),
  demoFile(
    "Un nom de fichier très long pour vérifier qu’il est bien coupé.pdf",
    "application/pdf",
    "public",
  ),
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
