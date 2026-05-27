import { describe, expect, it } from "vitest";

import { emojiToCodepoints, fluentEmojiUrl } from "../fluentEmoji";

const PINNED_REF = "@7a40f1a2d064d76e436813edc0f09b6c8cde5da8/";

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
  it("builds a 3d png url by default", () => {
    expect(fluentEmojiUrl("👍")).toBe(
      "https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode" +
        "@7a40f1a2d064d76e436813edc0f09b6c8cde5da8/assets/1f44d_3d.png",
    );
  });

  it("builds an svg url for non-3d styles", () => {
    expect(fluentEmojiUrl("👍", "color")).toMatch(/\/1f44d_color\.svg$/);
  });

  it("pins the cdn ref to an immutable commit", () => {
    expect(fluentEmojiUrl("👍")).toContain(PINNED_REF);
  });
});
