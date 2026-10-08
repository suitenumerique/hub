import { type InfiniteData, skipToken, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
  AccountId,
  ChatMember,
  ChatMessagesPage,
  ChatRef,
  ChatUser,
} from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import type { MentionCandidate } from "../composer/mentionMatching";

import { useChatMembers } from "./useChatMembers";

/** Who a composer can mention. */
export type ComposerMentionSource = {
  accountId: AccountId;
  /** The conversation, or `null` for a draft that does not exist yet. */
  chatRef: ChatRef | null;
  /** A draft's chosen participants, offered while there are no members yet. */
  participants?: readonly ChatUser[];
};

const NO_IDS: string[] = [];

/** Authors of the loaded messages, latest speaker first, without oneself. */
const recentSpeakerIds = (data: InfiniteData<ChatMessagesPage>): string[] => {
  const ids = new Set<string>();
  // The first page is the newest; each page reads oldest to newest.
  for (const page of data.pages) {
    for (const message of page.messages.toReversed()) {
      if (message.authorId !== "me") {
        ids.add(message.authorId);
      }
    }
  }
  return [...ids];
};

const memberCandidate = (member: ChatMember): MentionCandidate => ({
  id: member.id,
  name: member.name,
  rawName: member.rawName ?? member.name,
  ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
});

/**
 * People a composer offers to mention, as Element does: the conversation's
 * members and invitees except oneself, and the recent speakers to rank them.
 * Members load only once `wanted`, that is when someone types `@`.
 */
export const useMentionCandidates = (
  source: ComposerMentionSource | undefined,
  wanted: boolean,
) => {
  const chatRef = source?.chatRef ?? null;
  const isWanted = wanted && chatRef !== null;
  const { present, pendingInvites } = useChatMembers(chatRef, isWanted);
  const { data: speakers = NO_IDS } = useQuery({
    queryKey: chatRef ? chatKeys.messages(chatRef) : ["chat-messages", "none"],
    // Read what the timeline already loaded; never fetch from here.
    queryFn: skipToken,
    select: recentSpeakerIds,
    enabled: isWanted,
  });
  const participants = source?.participants;
  const candidates = useMemo<MentionCandidate[]>(() => {
    if (!chatRef) {
      return (participants ?? []).map((user) => ({
        id: user.id,
        name: user.name,
        rawName: user.name,
        ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
      }));
    }
    return [...present, ...pendingInvites]
      .filter((member) => !member.isCurrentUser)
      .map(memberCandidate);
  }, [chatRef, participants, pendingInvites, present]);
  return { candidates, recentSpeakerIds: speakers };
};
