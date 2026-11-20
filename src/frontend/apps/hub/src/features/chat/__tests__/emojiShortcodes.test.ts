import { describe, expect, it } from "vitest";

import {
  findClosedShortcode,
  findShortcodeTrigger,
  replaceShortcodes,
  shortcodeLookup,
  shortcodeRestLength,
} from "../composer/emojiShortcodes";

const lookup = shortcodeLookup([
  { emoji: "💯", shortcodes: ["100"] },
  { emoji: "🎉", shortcodes: ["tada"] },
]);

/** The shortcode being typed with the caret at the end of `text`. */
const triggerAtEnd = (text: string) =>
  findShortcodeTrigger(text, text.length, []);

describe("findShortcodeTrigger", () => {
  // A time is no shortcode: Enter would turn its minutes into an emoji
  // instead of sending the message.
  it.each(["See you at 10:30", "at 12:10", "10:00"])(
    "offers nothing for the minutes of a time: %s",
    (text) => {
      expect(triggerAtEnd(text)).toBeNull();
    },
  );

  it("starts a shortcode after a space", () => {
    expect(triggerAtEnd("Hi :tad")).toEqual({ start: 3, query: "tad" });
  });

  it("starts a shortcode glued to a word", () => {
    expect(triggerAtEnd("toto:tad")).toEqual({ start: 4, query: "tad" });
  });
});

describe("findClosedShortcode", () => {
  it("leaves a shortcode closed after a number as typed", () => {
    expect(findClosedShortcode("at 12:100:", 10, [], lookup)).toBeNull();
  });

  it("turns a shortcode closed after a space into its emoji", () => {
    expect(findClosedShortcode("hey :100:", 9, [], lookup)).toEqual({
      start: 4,
      emoji: "💯",
    });
  });
});

describe("replaceShortcodes", () => {
  it("leaves the shortcodes glued to a number in a pasted text", () => {
    expect(replaceShortcodes("At 12:100: then :tada:", lookup)).toBe(
      "At 12:100: then 🎉",
    );
  });

  it("leaves a shortcode pasted right after a number", () => {
    expect(replaceShortcodes(":tada:", lookup, "At 12")).toBe(":tada:");
    expect(replaceShortcodes(":tada:", lookup, "At ")).toBe("🎉");
  });
});

describe("shortcodeRestLength", () => {
  it("reaches the closing colon over accented letters", () => {
    expect(shortcodeRestLength(":thúmbsup: ok", 3)).toBe(
      ":thúmbsup:".length - 3,
    );
  });

  it("is 0 when no colon closes the shortcode", () => {
    expect(shortcodeRestLength(":tad end", 4)).toBe(0);
  });
});
