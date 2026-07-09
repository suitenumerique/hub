import { useSyncExternalStore } from "react";

import { createDriver, resolveDriverKind } from "@/features/config/Config";

import type { Driver } from "./Driver";
import type { AccountId, ChatAccountConfig } from "./types";

export type DriverEntry = ChatAccountConfig & {
  driver: Driver;
  settingsFingerprint: string;
};

const fallbackConfig = (): ChatAccountConfig => ({
  accountId: "default",
  kind: resolveDriverKind(),
  label: "default",
  criticality: "required",
  enabled: true,
});

const snapshotEquals = (a: DriverEntry[], b: DriverEntry[]): boolean =>
  a.length === b.length &&
  a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      entry.accountId === other.accountId &&
      entry.kind === other.kind &&
      entry.label === other.label &&
      entry.criticality === other.criticality &&
      entry.enabled === other.enabled &&
      entry.settingsFingerprint === other.settingsFingerprint &&
      entry.driver === other.driver
    );
  });

const fingerprintSettings = (
  settings: ChatAccountConfig["settings"],
): string => {
  try {
    return JSON.stringify(settings ?? null);
  } catch {
    return String(settings);
  }
};

export class DriverRegistry {
  private entries = new Map<AccountId, DriverEntry>();
  private snapshot: DriverEntry[] = [];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): DriverEntry[] => this.snapshot;

  get(accountId: AccountId): Driver {
    const entry = this.entries.get(accountId);
    if (!entry) {
      throw new Error(`Unknown chat account: ${accountId}`);
    }
    return entry.driver;
  }

  reconcile(configs: ChatAccountConfig[]): void {
    const enabledConfigs = this.prepareConfigs(configs);
    const nextEntries = new Map<AccountId, DriverEntry>();

    enabledConfigs.forEach((config) => {
      const existing = this.entries.get(config.accountId);
      const settingsFingerprint = fingerprintSettings(config.settings);
      const canReuseDriver =
        existing &&
        existing.kind === config.kind &&
        existing.settingsFingerprint === settingsFingerprint;
      const driver = canReuseDriver
        ? existing.driver
        : createDriver(config.kind, config.accountId, config.settings);

      if (existing && existing.driver !== driver) {
        existing.driver.destroy();
      }
      if (!existing || existing.driver !== driver) {
        driver.initialize();
      }

      nextEntries.set(config.accountId, {
        ...config,
        driver,
        settingsFingerprint,
      });
    });

    this.entries.forEach((entry, accountId) => {
      if (!nextEntries.has(accountId)) {
        entry.driver.destroy();
      }
    });

    const nextSnapshot = enabledConfigs.map(
      (config) => nextEntries.get(config.accountId) as DriverEntry,
    );

    this.entries = nextEntries;
    if (!snapshotEquals(this.snapshot, nextSnapshot)) {
      this.snapshot = nextSnapshot;
      this.emit();
    }
  }

  destroyAll(): void {
    this.entries.forEach((entry) => entry.driver.destroy());
    this.entries.clear();
    if (this.snapshot.length > 0) {
      this.snapshot = [];
      this.emit();
    }
  }

  private prepareConfigs(configs: ChatAccountConfig[]): ChatAccountConfig[] {
    const prepared = configs.length > 0 ? configs : [fallbackConfig()];
    const seen = new Set<AccountId>();

    prepared.forEach((config) => {
      if (seen.has(config.accountId)) {
        throw new Error(`Duplicate chat account id: ${config.accountId}`);
      }
      seen.add(config.accountId);
    });

    return prepared.filter((config) => config.enabled);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let registry = new DriverRegistry();

export const getRegistry = (): DriverRegistry => registry;

export const useDriverEntries = (): DriverEntry[] => {
  const currentRegistry = getRegistry();
  return useSyncExternalStore(
    currentRegistry.subscribe,
    currentRegistry.getSnapshot,
    currentRegistry.getSnapshot,
  );
};

export const resetRegistryForTests = (): DriverRegistry => {
  registry.destroyAll();
  registry = new DriverRegistry();
  return registry;
};
