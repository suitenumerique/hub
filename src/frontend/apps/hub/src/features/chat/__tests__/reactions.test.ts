import { describe, expect, it } from "vitest";

import type { ChatReaction } from "@/features/drivers/types";

import { keepReactionOrder, toggleReaction } from "../reactions";

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

describe("keepReactionOrder", () => {
  const thumbs = (count: number): ChatReaction => ({
    emoji: "👍",
    count,
    reactedByMe: false,
  });
  const check = (count: number): ChatReaction => ({
    emoji: "✅",
    count,
    reactedByMe: false,
  });
  const party = (count: number): ChatReaction => ({
    emoji: "🎉",
    count,
    reactedByMe: true,
  });

  it("keeps the shown order when counts change", () => {
    expect(
      keepReactionOrder([thumbs(1), check(1)], [check(3), thumbs(1)]),
    ).toEqual([thumbs(1), check(3)]);
  });

  it("puts a new emoji where it first appeared, last for a new one", () => {
    expect(
      keepReactionOrder([thumbs(1), check(1)], [check(2), thumbs(1), party(1)]),
    ).toEqual([thumbs(1), check(2), party(1)]);
  });

  it("puts back an older emoji that shows up late", () => {
    // An encrypted reaction decrypted after the others were shown.
    expect(keepReactionOrder([check(1)], [thumbs(1), check(1)])).toEqual([
      thumbs(1),
      check(1),
    ]);
  });

  it("drops emojis that are gone without moving the others", () => {
    expect(
      keepReactionOrder([party(1), thumbs(1), check(1)], [check(2), party(1)]),
    ).toEqual([party(1), check(2)]);
  });

  it("matches variant spellings of the same emoji", () => {
    const heart = { emoji: "❤️", count: 2, reactedByMe: false };
    expect(
      keepReactionOrder(
        [{ emoji: "❤", count: 1, reactedByMe: false }, thumbs(1)],
        [thumbs(1), heart],
      ),
    ).toEqual([heart, thumbs(1)]);
  });

  it("takes the new order when nothing was shown", () => {
    expect(keepReactionOrder([], [check(1), thumbs(1)])).toEqual([
      check(1),
      thumbs(1),
    ]);
  });
});
