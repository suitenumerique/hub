import type { Chat } from "@/features/drivers/types";

/**
 * Mock conversations bundled with the frontend until the backend exposes a
 * real chats endpoint. `MockChat` is kept as a type alias of `Chat` so
 * existing imports keep working — production code should depend on `Chat`
 * from `@/features/drivers/types` and reach those mocks through the driver.
 */
export type MockChat = Chat;

export const MOCK_CHATS: Chat[] = [
  {
    id: "a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c",
    name: "Didier Salambo",
    section: "favourites",
    kind: "direct",
    participantIds: ["user-didier-salambo"],
    visual: { kind: "initials" },
  },
  {
    id: "b4e2c3d1-2e3f-4a5b-8c9d-6e7f8a9b0c1d",
    name: "Working group",
    section: "favourites",
    kind: "group",
    participantIds: [
      "user-didier-salambo",
      "user-anabelle-dupontel",
      "user-jean-dustaff",
    ],
    visual: { kind: "emoji", emoji: "🌲" },
  },
  {
    id: "c5d3e4f2-3f4a-4b5c-9d0e-7f8a9b0c1d2e",
    name: "Anabelle Dupontel",
    section: "all",
    kind: "direct",
    unread: true,
    participantIds: ["user-anabelle-dupontel"],
    visual: { kind: "initials" },
  },
  {
    id: "d6e4f5a3-4a5b-4c6d-ae1f-8a9b0c1d2e3f",
    name: "André Campan, Edouard McDonald",
    section: "all",
    kind: "group",
    unread: true,
    participantIds: ["user-andre-campan", "user-edouard-mcdonald"],
    visual: { kind: "icon", icon: "groups" },
  },
  {
    id: "e7f5a6b4-5b6c-4d7e-bf2a-9b0c1d2e3f4a",
    name: "Fichiers team",
    section: "all",
    kind: "group",
    participantIds: [
      "user-berangere-becker",
      "user-jean-dustaff",
      "user-anabelle-dupontel",
    ],
    visual: { kind: "emoji", emoji: "🎉" },
  },
  {
    id: "f8a6b7c5-6c7d-4e8f-803b-ac1d2e3f4a5b",
    name: "Teams team",
    section: "all",
    kind: "group",
    participantIds: ["user-didier-salambo", "user-berangere-becker"],
    visual: { kind: "emoji", emoji: "👎" },
  },
  {
    id: "09b7c8d6-7d8e-4f9a-914c-bd2e3f4a5b6c",
    name: "Jean Dustaff",
    section: "all",
    kind: "direct",
    participantIds: ["user-jean-dustaff"],
    visual: { kind: "initials" },
  },
  {
    id: "1ac8d9e7-8e9f-40ab-a25d-ce3f4a5b6c7d",
    name: "Bérangère Becker",
    section: "all",
    kind: "direct",
    participantIds: ["user-berangere-becker"],
    visual: { kind: "initials" },
  },
  {
    id: "2bd9eaf8-9fa0-41bc-b36e-df4a5b6c7d8e",
    name: "Team chocolate",
    section: "all",
    kind: "group",
    participantIds: ["user-amandine-salambo", "user-daniel-ferioux"],
    visual: { kind: "emoji", emoji: "❤️" },
  },
];

export const FAVOURITE_CHATS = MOCK_CHATS.filter(
  (chat) => chat.section === "favourites",
);
export const ALL_CHATS = MOCK_CHATS.filter((chat) => chat.section === "all");

export const getMockChat = (id: string): Chat | undefined =>
  MOCK_CHATS.find((chat) => chat.id === id);

const sameParticipantSet = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
};

export const getMockChatForUsers = (userIds: string[]): Chat | null =>
  MOCK_CHATS.find((chat) => sameParticipantSet(chat.participantIds, userIds)) ??
  null;
