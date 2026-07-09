import { describe, expect, it } from "vitest";

import { parseMatrixDriverSettings, TCHAP_PRESET } from "../config";

describe("parseMatrixDriverSettings", () => {
  it("falls back to the Tchap preset when settings are empty", () => {
    expect(parseMatrixDriverSettings({})).toEqual(TCHAP_PRESET);
  });

  it("falls back to the Tchap preset when called with no argument", () => {
    expect(parseMatrixDriverSettings()).toEqual(TCHAP_PRESET);
  });

  it("reads a full fixed-discovery configuration", () => {
    const settings = parseMatrixDriverSettings({
      discovery: "fixed",
      baseUrl: "http://localhost:9808",
      serverName: "localhost",
      branding: { clientName: "Hub", logoUri: "http://localhost:9800/x.svg" },
      loginHint: "hub@example.com",
      oidcClientId: "01J00000000000000000000000",
      autoJoinInvites: true,
    });

    expect(settings).toEqual({
      discovery: "fixed",
      baseUrl: "http://localhost:9808",
      serverName: "localhost",
      branding: { clientName: "Hub", logoUri: "http://localhost:9800/x.svg" },
      loginHint: "hub@example.com",
      oidcClientId: "01J00000000000000000000000",
      autoJoinInvites: true,
    });
  });

  it("defaults the unset fields of a partial configuration", () => {
    const settings = parseMatrixDriverSettings({ discovery: "fixed" });

    expect(settings.discovery).toBe("fixed");
    expect(settings.baseUrl).toBe(TCHAP_PRESET.baseUrl);
    expect(settings.serverName).toBe(TCHAP_PRESET.serverName);
    expect(settings.branding).toEqual(TCHAP_PRESET.branding);
    expect(settings.loginHint).toBeUndefined();
    expect(settings.oidcClientId).toBeUndefined();
    expect(settings.autoJoinInvites).toBe(false);
  });

  it("ignores malformed fields without throwing", () => {
    const settings = parseMatrixDriverSettings({
      discovery: "nonsense",
      baseUrl: 42,
      serverName: null,
      branding: "not-an-object",
      loginHint: { not: "a string" },
      oidcClientId: 123,
      autoJoinInvites: "yes",
    } as unknown as Record<string, unknown>);

    expect(settings).toEqual(TCHAP_PRESET);
  });

  it("keeps a valid branding field while defaulting its missing sub-fields", () => {
    const settings = parseMatrixDriverSettings({
      branding: { logoUri: "http://localhost:9800/logo.svg" },
    });

    expect(settings.branding.clientName).toBe(TCHAP_PRESET.branding.clientName);
    expect(settings.branding.logoUri).toBe("http://localhost:9800/logo.svg");
  });
});
