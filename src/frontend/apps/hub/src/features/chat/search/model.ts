import type { LocalChat } from "@/features/drivers/types";

export type SearchMode = "participants" | "name-only";
export type SearchMember = { name: string };
export type SearchRoom = {
  id: string;
  chat?: LocalChat;
  explicitName?: string;
  alias?: string;
  count: number | null;
  mode?: SearchMode;
  members: Record<string, SearchMember>;
  /** True only for a snapshot advanced through an uninterrupted sync chain. */
  coherent: boolean;
};

/** Completeness deliberately does not participate in the hysteresis rule. */
export const searchMode = (
  previous: SearchMode | undefined,
  count: number,
): SearchMode => {
  const participantLimit = previous === "participants" ? 60 : 50;
  return count <= participantLimit ? "participants" : "name-only";
};

export const normalizeSearch = (value: string): string =>
  value.normalize("NFC").trim().toLowerCase();

export const emptySearchRoom = (id: string): SearchRoom => ({
  id,
  count: null,
  members: {},
  coherent: false,
});

/** Relit aussi les anciens caches, en ne conservant que les données utiles. */
export const restoreSearchRoom = (room: SearchRoom): SearchRoom => ({
  id: room.id,
  chat: room.chat,
  explicitName: room.explicitName,
  alias: room.alias,
  count: room.count,
  mode: room.mode,
  coherent: room.coherent,
  members: Object.fromEntries(
    Object.entries(room.members).map(([id, member]) => [
      id,
      { name: member.name },
    ]),
  ),
});

export const isComplete = (room: SearchRoom, self: string): boolean =>
  room.coherent &&
  room.count !== null &&
  room.count > 0 &&
  Object.keys(room.members).length === room.count &&
  Object.hasOwn(room.members, self);

export type SearchDocument = {
  chat: LocalChat;
  fields: string[];
  subtitle: string;
};

export const searchDocument = (
  room: SearchRoom,
  self: string,
): SearchDocument | null => {
  if (!room.chat) return null;
  const names = Object.entries(room.members)
    .filter(([id]) => id !== self)
    .map(([, member]) => member.name);
  return {
    chat: room.chat,
    fields: [
      room.chat.name,
      room.explicitName ?? "",
      room.alias ?? "",
      ...(room.mode === "participants" ? names : []),
    ].map(normalizeSearch),
    subtitle: names.join(", "),
  };
};

export const yieldSearchWork = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));
