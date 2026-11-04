/**
 * Reads a conversation's notification level from the Matrix push rules, the way
 * Tchap and Element store it (`RoomNotifs.ts` and `toNotificationSettings.ts` in
 * Tchap), so that the three clients show the same level. Pure: no client.
 */
import {
  ConditionKind,
  type IPushRule,
  type IPushRules,
  PushRuleActionName,
  RuleId,
} from "matrix-js-sdk/lib/matrix";

import type {
  ChatEffectiveNotificationLevel,
  ChatNotificationLevel,
} from "../types";

/** `dont_notify` is equivalent to an empty list of actions. */
const isDontNotifyRule = (rule: IPushRule): boolean =>
  rule.actions.length === 0 ||
  (rule.actions.length === 1 &&
    rule.actions[0] === PushRuleActionName.DontNotify);

/** The room an override rule mutes, when it is such a rule. */
const roomMutedBy = (rule: IPushRule): string | undefined => {
  const condition = rule.conditions?.length === 1 && rule.conditions[0];
  return condition &&
    condition.kind === ConditionKind.EventMatch &&
    condition.key === "room_id" &&
    isDontNotifyRule(rule)
    ? condition.pattern
    : undefined;
};

/** The rule muting a room. A disabled rule counts as absent. */
export const findRoomMuteRule = (
  rules: IPushRules,
  roomId: string,
): IPushRule | undefined =>
  rules.global.override?.find(
    (rule) => rule.enabled && roomMutedBy(rule) === roomId,
  );

export const isRoomMuted = (rules: IPushRules, roomId: string): boolean =>
  findRoomMuteRule(rules, roomId) !== undefined;

/** Notifications turned off for the whole account, in Tchap's settings. */
export const isGlobalMuteEnabled = (rules: IPushRules): boolean =>
  rules.global.override?.find((rule) => rule.rule_id === RuleId.Master)
    ?.enabled === true;

/** Mute rule first, then room rule, otherwise no setting of its own. */
export const readNotificationLevel = (
  rules: IPushRules,
  roomId: string,
): ChatNotificationLevel => {
  if (isRoomMuted(rules, roomId)) {
    return "mute";
  }
  const roomRule = rules.global.room?.find((rule) => rule.rule_id === roomId);
  if (!roomRule?.enabled) {
    return "default";
  }
  if (isDontNotifyRule(roomRule)) {
    return "mentions_and_following";
  }
  return roomRule.actions.includes(PushRuleActionName.Notify)
    ? "all_messages"
    : "default";
};

const GROUP_RULES: string[] = [RuleId.Message, RuleId.EncryptedMessage];
const ONE_TO_ONE_RULES: string[] = [RuleId.DM, RuleId.EncryptedDM];

const notifiesAny = (rules: IPushRules, ruleIds: string[]): boolean =>
  rules.global.underride?.some(
    (rule) =>
      ruleIds.includes(rule.rule_id) &&
      rule.enabled &&
      rule.actions.includes(PushRuleActionName.Notify),
  ) ?? false;

/** What a conversation without any setting of its own inherits. */
export const inheritedNotificationLevel = (
  rules: IPushRules,
  isOneToOne: boolean,
): ChatEffectiveNotificationLevel =>
  notifiesAny(rules, isOneToOne ? ONE_TO_ONE_RULES : GROUP_RULES)
    ? "all_messages"
    : "mentions_and_following";

export const notificationLevelsOf = (
  rules: IPushRules,
  roomId: string,
  isOneToOne: boolean,
): {
  notificationLevel: ChatNotificationLevel;
  effectiveNotificationLevel: ChatEffectiveNotificationLevel;
} => {
  const notificationLevel = readNotificationLevel(rules, roomId);
  return {
    notificationLevel,
    effectiveNotificationLevel:
      notificationLevel === "default"
        ? inheritedNotificationLevel(rules, isOneToOne)
        : notificationLevel,
  };
};

/** What the push rules say of every conversation, to compare two versions. */
export type NotificationRulesSnapshot = {
  /** Only the rooms with a setting of their own. */
  levels: Map<string, ChatNotificationLevel>;
  inherited: {
    group: ChatEffectiveNotificationLevel;
    oneToOne: ChatEffectiveNotificationLevel;
  };
};

export const notificationRulesSnapshot = (
  rules: IPushRules,
): NotificationRulesSnapshot => {
  const roomIds = new Set(rules.global.room?.map((rule) => rule.rule_id));
  rules.global.override?.forEach((rule) => {
    const roomId = roomMutedBy(rule);
    if (roomId) roomIds.add(roomId);
  });
  const levels = new Map<string, ChatNotificationLevel>();
  roomIds.forEach((roomId) => {
    const level = readNotificationLevel(rules, roomId);
    if (level !== "default") levels.set(roomId, level);
  });
  return {
    levels,
    inherited: {
      group: inheritedNotificationLevel(rules, false),
      oneToOne: inheritedNotificationLevel(rules, true),
    },
  };
};

/** The rooms whose own level differs between two versions of the rules. */
export const roomsWithChangedLevel = (
  previous: NotificationRulesSnapshot,
  next: NotificationRulesSnapshot,
): string[] =>
  [...new Set([...previous.levels.keys(), ...next.levels.keys()])].filter(
    (roomId) => previous.levels.get(roomId) !== next.levels.get(roomId),
  );

export const hasInheritedLevelChanged = (
  previous: NotificationRulesSnapshot,
  next: NotificationRulesSnapshot,
): boolean =>
  previous.inherited.group !== next.inherited.group ||
  previous.inherited.oneToOne !== next.inherited.oneToOne;
