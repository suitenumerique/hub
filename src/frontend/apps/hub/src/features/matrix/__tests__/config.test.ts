import { describe, expect, it } from "vitest";

import {
  MATRIX_LOCAL_SETTINGS,
  MIJNBUREAU_SETTINGS,
  parseMatrixDriverSettings,
} from "../config";

describe("parseMatrixDriverSettings", () => {
  it("accepts the local manifest", () => {
    expect(parseMatrixDriverSettings(MATRIX_LOCAL_SETTINGS)).toEqual({
      ...MATRIX_LOCAL_SETTINGS,
      externalClientUrl: "http://localhost:9807/",
    });
  });

  it("accepts a fixed manifest with a dynamically registered client", () => {
    expect(parseMatrixDriverSettings(MIJNBUREAU_SETTINGS)).toEqual({
      ...MIJNBUREAU_SETTINGS,
      externalClientUrl: "https://element.open-desk.nl/",
    });
  });

  it("rejects a manifest with both OAuth client forms", () => {
    expect(() =>
      parseMatrixDriverSettings({
        ...MATRIX_LOCAL_SETTINGS,
        clientName: "LaSuite Hub",
      }),
    ).toThrow(
      'Matrix account settings "oidcClientId" and "clientName" are exclusive.',
    );
  });

  it("rejects a manifest without a fixed server or MAS client", () => {
    expect(() => parseMatrixDriverSettings({})).toThrow(
      'Matrix account setting "baseUrl" is required.',
    );
  });
});
