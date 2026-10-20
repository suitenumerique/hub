import { describe, expect, it } from "vitest";

import { MATRIX_LOCAL_SETTINGS, parseMatrixDriverSettings } from "../config";

describe("parseMatrixDriverSettings", () => {
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
