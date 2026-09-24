import { describe, expect, it } from "vitest";

import { MATRIX_LOCAL_SETTINGS, parseMatrixDriverSettings } from "../config";

describe("parseMatrixDriverSettings", () => {
  it("reads a fixed Matrix account configuration", () => {
    const settings = parseMatrixDriverSettings({
      ...MATRIX_LOCAL_SETTINGS,
      loginHint: "hub@example.com",
    });

    expect(settings).toEqual({
      ...MATRIX_LOCAL_SETTINGS,
      externalClientUrl: "http://localhost:9807/",
      loginHint: "hub@example.com",
    });
  });

  it("accepts the local manifest", () => {
    expect(parseMatrixDriverSettings(MATRIX_LOCAL_SETTINGS)).toEqual({
      ...MATRIX_LOCAL_SETTINGS,
      externalClientUrl: "http://localhost:9807/",
    });
  });

  it("rejects a manifest without a fixed server or MAS client", () => {
    expect(() => parseMatrixDriverSettings({})).toThrow(
      'Matrix account setting "baseUrl" is required.',
    );
  });
});
