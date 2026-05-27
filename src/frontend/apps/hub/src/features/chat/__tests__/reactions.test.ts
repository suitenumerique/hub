import { describe, expect, it } from "vitest";

import type { ChatReaction } from "@/features/drivers/types";

import { toggleReaction } from "../reactions";

describe("toggleReaction", () => {
  it("adds a brand-new reaction as the current user's", () => {
    expect(toggleReaction([], "👍")).toEqual([
      { emoji: "👍", count: 1, reactedByMe: true },
    ]);
  });

  it("joins an existing reaction the user has not made yet", () => {
    const before: ChatReaction[] = [
      { emoji: "👍", count: 2, reactedByMe: false },
    ];
    expect(toggleReaction(before, "👍")).toEqual([
      { emoji: "👍", count: 3, reactedByMe: true },
    ]);
  });

  it("removes the user's reaction while keeping others' count", () => {
    const before: ChatReaction[] = [
      { emoji: "👍", count: 3, reactedByMe: true },
    ];
    expect(toggleReaction(before, "👍")).toEqual([
      { emoji: "👍", count: 2, reactedByMe: false },
    ]);
  });

  it("drops the reaction entirely when the last user removes it", () => {
    const before: ChatReaction[] = [
      { emoji: "👍", count: 1, reactedByMe: true },
    ];
    expect(toggleReaction(before, "👍")).toEqual([]);
  });

  it("collapses variant emoji encodings onto a single reaction", () => {
    // "❤️" carries the fe0f variation selector; "❤" does not — both must
    // resolve to the same chip.
    const before: ChatReaction[] = [
      { emoji: "❤️", count: 1, reactedByMe: false },
    ];
    const after = toggleReaction(before, "❤");
    expect(after).toHaveLength(1);
    expect(after[0].count).toBe(2);
    expect(after[0].reactedByMe).toBe(true);
  });

  it("appends a new reaction after the existing ones", () => {
    const before: ChatReaction[] = [
      { emoji: "👍", count: 1, reactedByMe: true },
    ];
    expect(toggleReaction(before, "🎉")).toEqual([
      { emoji: "👍", count: 1, reactedByMe: true },
      { emoji: "🎉", count: 1, reactedByMe: true },
    ]);
  });

  it("does not mutate the input array or its reactions", () => {
    const before: ChatReaction[] = [
      { emoji: "👍", count: 1, reactedByMe: false },
    ];
    const snapshot = before.map((reaction) => ({ ...reaction }));
    toggleReaction(before, "👍");
    expect(before).toEqual(snapshot);
  });
});
