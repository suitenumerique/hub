import { describe, expect, it } from "vitest";

import { emojiToCodepoints, fluentEmojiUrl } from "../fluentEmoji";

describe("emojiToCodepoints", () => {
  it("encodes a single-codepoint emoji", () => {
    expect(emojiToCodepoints("👋")).toBe("1f44b");
  });

  it("encodes a skin-tone modifier sequence", () => {
    expect(emojiToCodepoints("👋🏿")).toBe("1f44b-1f3ff");
  });

  it("drops the fe0f variation selector and keeps the 200d joiner", () => {
    expect(emojiToCodepoints("🧑🏾‍🎨")).toBe("1f9d1-1f3fe-200d-1f3a8");
  });

  it("zero-pads short codepoints to 4 digits (keycap)", () => {
    expect(emojiToCodepoints("1️⃣")).toBe("0031-20e3");
  });
});

describe("fluentEmojiUrl", () => {
  it("points at the drawing the Hub serves", () => {
    expect(fluentEmojiUrl("👍")).toBe("/emoji/fluent/1f44d.svg");
  });
});
