import type { IPushRule, IPushRules } from "matrix-js-sdk/lib/matrix";
import { describe, expect, it } from "vitest";

import {
  hasInheritedLevelChanged,
  inheritedNotificationLevel,
  isGlobalMuteEnabled,
  isRoomMuted,
  notificationLevelsOf,
  notificationRulesSnapshot,
  readNotificationLevel,
  roomsWithChangedLevel,
} from "../matrixNotificationLevels";

const ROOM_ID = "!room:localhost";

const rule = (ruleId: string, overrides: Partial<IPushRule> = {}): IPushRule =>
  ({
    rule_id: ruleId,
    default: false,
    enabled: true,
    actions: [],
    ...overrides,
  }) as IPushRule;

const muteRule = (roomId: string, overrides: Partial<IPushRule> = {}) =>
  rule(roomId, {
    actions: ["dont_notify"],
    conditions: [{ kind: "event_match", key: "room_id", pattern: roomId }],
    ...overrides,
  } as Partial<IPushRule>);

const roomRule = (actions: unknown[], overrides: Partial<IPushRule> = {}) =>
  rule(ROOM_ID, { actions, ...overrides } as Partial<IPushRule>);

const ALL_MESSAGES = ["notify", { set_tweak: "sound", value: "default" }];

const rules = (global: Partial<IPushRules["global"]>): IPushRules =>
  ({ global, device: {} }) as unknown as IPushRules;

const underride = (
  ruleId: string,
  actions: unknown[],
  enabled = true,
): IPushRule => rule(ruleId, { actions, enabled } as Partial<IPushRule>);

describe("readNotificationLevel", () => {
  it("reads a chat without any rule as default", () => {
    expect(readNotificationLevel(rules({}), ROOM_ID)).toBe("default");
    expect(
      readNotificationLevel(rules({ room: [], override: [] }), ROOM_ID),
    ).toBe("default");
  });

  it("reads a notify room rule with its sound as all messages", () => {
    expect(
      readNotificationLevel(rules({ room: [roomRule(ALL_MESSAGES)] }), ROOM_ID),
    ).toBe("all_messages");
  });

  it("reads a notify room rule without sound as all messages", () => {
    expect(
      readNotificationLevel(rules({ room: [roomRule(["notify"])] }), ROOM_ID),
    ).toBe("all_messages");
  });

  it.each([[["dont_notify"]], [[]]])(
    "reads the room rule %j as mentions and following",
    (actions) => {
      expect(
        readNotificationLevel(rules({ room: [roomRule(actions)] }), ROOM_ID),
      ).toBe("mentions_and_following");
    },
  );

  it("reads the override rule of the room as mute, before its room rule", () => {
    expect(
      readNotificationLevel(
        rules({
          override: [muteRule(ROOM_ID)],
          room: [roomRule(ALL_MESSAGES)],
        }),
        ROOM_ID,
      ),
    ).toBe("mute");
  });

  it("ignores the mute rule of another room", () => {
    expect(
      readNotificationLevel(
        rules({ override: [muteRule("!other:localhost")] }),
        ROOM_ID,
      ),
    ).toBe("default");
  });

  it("does not take an override rule with other conditions for a mute", () => {
    const narrowRule = muteRule(ROOM_ID, {
      conditions: [
        { kind: "event_match", key: "room_id", pattern: ROOM_ID },
        { kind: "event_match", key: "type", pattern: "m.room.message" },
      ],
    } as Partial<IPushRule>);
    expect(isRoomMuted(rules({ override: [narrowRule] }), ROOM_ID)).toBe(false);
  });

  it("counts a disabled rule as absent", () => {
    expect(
      readNotificationLevel(
        rules({
          override: [muteRule(ROOM_ID, { enabled: false })],
          room: [roomRule(ALL_MESSAGES, { enabled: false })],
        }),
        ROOM_ID,
      ),
    ).toBe("default");
    expect(
      readNotificationLevel(
        rules({
          override: [muteRule(ROOM_ID, { enabled: false })],
          room: [roomRule(["dont_notify"])],
        }),
        ROOM_ID,
      ),
    ).toBe("mentions_and_following");
  });
});

describe("inheritedNotificationLevel", () => {
  const groupRules = [".m.rule.message", ".m.rule.encrypted"];
  const oneToOneRules = [
    ".m.rule.room_one_to_one",
    ".m.rule.encrypted_room_one_to_one",
  ];

  it.each([
    { ids: groupRules, isOneToOne: false },
    { ids: oneToOneRules, isOneToOne: true },
  ])(
    "reads all messages when a rule of $ids notifies",
    ({ ids, isOneToOne }) => {
      expect(
        inheritedNotificationLevel(
          rules({
            underride: [
              underride(ids[0], ["dont_notify"]),
              underride(ids[1], ["notify"]),
            ],
          }),
          isOneToOne,
        ),
      ).toBe("all_messages");
    },
  );

  it("reads mentions and following when no rule notifies", () => {
    expect(
      inheritedNotificationLevel(
        rules({
          underride: [
            underride(groupRules[0], ["dont_notify"]),
            underride(groupRules[1], ["notify"], false),
            underride(oneToOneRules[0], ["notify"]),
          ],
        }),
        false,
      ),
    ).toBe("mentions_and_following");
  });

  it("gives a chat in default what it inherits, any other its own level", () => {
    const all = rules({
      underride: [underride(".m.rule.message", ["notify"])],
    });
    expect(notificationLevelsOf(all, ROOM_ID, false)).toEqual({
      notificationLevel: "default",
      effectiveNotificationLevel: "all_messages",
    });
    expect(
      notificationLevelsOf(
        rules({ ...all.global, override: [muteRule(ROOM_ID)] }),
        ROOM_ID,
        false,
      ),
    ).toEqual({
      notificationLevel: "mute",
      effectiveNotificationLevel: "mute",
    });
  });
});

describe("isGlobalMuteEnabled", () => {
  it("follows the master rule", () => {
    const master = (enabled: boolean) =>
      rules({
        override: [
          rule(".m.rule.master", {
            enabled,
            default: true,
          } as Partial<IPushRule>),
        ],
      });
    expect(isGlobalMuteEnabled(master(true))).toBe(true);
    expect(isGlobalMuteEnabled(master(false))).toBe(false);
    expect(isGlobalMuteEnabled(rules({}))).toBe(false);
  });

  it("changes nothing to the levels shown", () => {
    const global = {
      underride: [underride(".m.rule.message", ["notify"])],
      room: [roomRule(["dont_notify"])],
    };
    const master = rule(".m.rule.master", {
      enabled: true,
      default: true,
    } as Partial<IPushRule>);
    expect(
      notificationLevelsOf(
        rules({ ...global, override: [master] }),
        ROOM_ID,
        false,
      ),
    ).toEqual(notificationLevelsOf(rules(global), ROOM_ID, false));
  });
});

describe("comparing two versions of the rules", () => {
  it("names the rooms whose level changed, and only them", () => {
    const other = "!other:localhost";
    const same = "!same:localhost";
    const previous = notificationRulesSnapshot(
      rules({
        override: [muteRule(other)],
        room: [
          roomRule(ALL_MESSAGES),
          rule(same, { actions: ["dont_notify"] } as Partial<IPushRule>),
        ],
      }),
    );
    const next = notificationRulesSnapshot(
      rules({
        override: [muteRule(ROOM_ID)],
        room: [rule(same, { actions: ["dont_notify"] } as Partial<IPushRule>)],
      }),
    );
    expect(roomsWithChangedLevel(previous, next).sort()).toEqual(
      [ROOM_ID, other].sort(),
    );
  });

  it("sees a room disabled or enabled again", () => {
    const enabled = notificationRulesSnapshot(
      rules({ room: [roomRule(["notify"])] }),
    );
    const disabled = notificationRulesSnapshot(
      rules({ room: [roomRule(["notify"], { enabled: false })] }),
    );
    expect(roomsWithChangedLevel(enabled, disabled)).toEqual([ROOM_ID]);
    expect(roomsWithChangedLevel(disabled, enabled)).toEqual([ROOM_ID]);
  });

  it("tells when the inherited level changes", () => {
    const notifying = notificationRulesSnapshot(
      rules({ underride: [underride(".m.rule.message", ["notify"])] }),
    );
    const silent = notificationRulesSnapshot(
      rules({ underride: [underride(".m.rule.message", ["dont_notify"])] }),
    );
    expect(hasInheritedLevelChanged(notifying, silent)).toBe(true);
    expect(hasInheritedLevelChanged(notifying, notifying)).toBe(false);
  });
});
