import { describe, expect, it } from "vitest";

import { isJson } from "../utils";

describe("isJson", () => {
  it("returns true for valid JSON strings", () => {
    expect(isJson('{"foo":"bar"}')).toBe(true);
    expect(isJson("[]")).toBe(true);
    expect(isJson("42")).toBe(true);
  });

  it("returns false for invalid JSON strings", () => {
    expect(isJson("not json")).toBe(false);
    expect(isJson("{foo:bar}")).toBe(false);
    expect(isJson("")).toBe(false);
  });
});
