import { describe, expect, it } from "vitest";

import { MATRIX_LOCAL_SETTINGS, parseMatrixDriverSettings } from "../config";

describe("parseMatrixDriverSettings", () => {
  it("reads a fixed Matrix account configuration", () => {
    const settings = parseMatrixDriverSettings({
      baseUrl: "http://localhost:9808",
      serverName: "localhost",
      loginHint: "hub@example.com",
      oidcClientId: "01J00000000000000000000000",
    });

    expect(settings).toEqual({
      baseUrl: "http://localhost:9808",
      serverName: "localhost",
      loginHint: "hub@example.com",
      oidcClientId: "01J00000000000000000000000",
    });
  });

  it("accepts the local manifest", () => {
    expect(parseMatrixDriverSettings(MATRIX_LOCAL_SETTINGS)).toEqual(
      MATRIX_LOCAL_SETTINGS,
    );
  });

  it("rejects a manifest without a fixed server or MAS client", () => {
    expect(() => parseMatrixDriverSettings({})).toThrow(
      'Matrix account setting "baseUrl" is required.',
    );
  });
});
