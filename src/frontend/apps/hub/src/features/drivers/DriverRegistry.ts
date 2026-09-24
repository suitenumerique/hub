import { useSyncExternalStore } from "react";

import { createDriver } from "@/features/config/Config";

import type { Driver } from "./Driver";
import type { AccountId, ChatAccountConfig } from "./types";

export type DriverEntry = ChatAccountConfig & {
  driver: Driver;
  settingsFingerprint: string;
};

/** Lifecycle metadata exists only after the registry owns an entry. */
export type RegisteredDriverEntry = DriverEntry & {
  /** Hub user owning this driver; an account id alone can span several logins. */
  sessionOwner: string | null;
  /** Included in connection query keys so a new driver cannot reuse old results. */
  generation: number;
};

const snapshotEquals = (a: DriverEntry[], b: DriverEntry[]): boolean =>
  a.length === b.length &&
  a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      entry.accountId === other.accountId &&
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
  private generation = 0;
  private entries = new Map<AccountId, RegisteredDriverEntry>();
  private snapshot: RegisteredDriverEntry[] = [];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): RegisteredDriverEntry[] => this.snapshot;

  get(accountId: AccountId): Driver {
    const entry = this.entries.get(accountId);
    if (!entry) {
      throw new Error(`Unknown chat account: ${accountId}`);
    }
    return entry.driver;
  }

  reconcile(
    configs: ChatAccountConfig[],
    sessionOwner: string | null = null,
  ): void {
    const enabledConfigs = this.prepareConfigs(configs);
    const nextEntries = new Map<AccountId, RegisteredDriverEntry>();

    enabledConfigs.forEach((config) => {
      const existing = this.entries.get(config.accountId);
      const settingsFingerprint = fingerprintSettings(config.settings);
      const canReuseDriver =
        existing &&
        existing.settingsFingerprint === settingsFingerprint &&
        existing.sessionOwner === sessionOwner;
      const driver = canReuseDriver
        ? existing.driver
        : createDriver(config.accountId, config.settings ?? {});

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
        sessionOwner,
        generation: canReuseDriver ? existing.generation : ++this.generation,
      });
    });

    this.entries.forEach((entry, accountId) => {
      if (!nextEntries.has(accountId)) {
        entry.driver.destroy();
      }
    });

    const nextSnapshot = enabledConfigs.map(
      (config) => nextEntries.get(config.accountId) as RegisteredDriverEntry,
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

  async shutdownAll(): Promise<void> {
    const work = this.snapshot.map(({ driver }) => driver.shutdown());
    this.destroyAll();
    await Promise.allSettled(work);
  }

  private prepareConfigs(configs: ChatAccountConfig[]): ChatAccountConfig[] {
    const seen = new Set<AccountId>();

    configs.forEach((config) => {
      if (seen.has(config.accountId)) {
        throw new Error(`Duplicate chat account id: ${config.accountId}`);
      }
      seen.add(config.accountId);
    });

    return configs.filter((config) => config.enabled);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let registry = new DriverRegistry();

export const getRegistry = (): DriverRegistry => registry;

export const useDriverEntries = (): RegisteredDriverEntry[] => {
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
