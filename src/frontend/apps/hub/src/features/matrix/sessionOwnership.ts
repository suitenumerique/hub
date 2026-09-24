/** Browser ownership is held until all work using the stores has stopped. */
export class MatrixOwnershipError extends Error {
  constructor(readonly reason: "another-tab" | "unsupported") {
    super(reason);
  }
}

export class MatrixSessionOwnership {
  private releases = new Map<string, () => void>();

  get held(): boolean {
    return this.releases.size > 0;
  }

  async acquire(resources: string[]): Promise<void> {
    if (!navigator.locks) throw new MatrixOwnershipError("unsupported");
    const acquired: string[] = [];
    try {
      for (const resource of [...new Set(resources)].sort()) {
        if (this.releases.has(resource)) continue;
        await new Promise<void>((resolve, reject) => {
          void navigator.locks
            .request(
              `hub-matrix:${resource}`,
              { mode: "exclusive", ifAvailable: true },
              async (lock) => {
                if (!lock) {
                  reject(new MatrixOwnershipError("another-tab"));
                  return;
                }
                // Web Locks holds ownership until this callback settles. Keep
                // it pending until the driver has drained and closed its stores.
                await new Promise<void>((release) => {
                  this.releases.set(resource, release);
                  acquired.push(resource);
                  resolve();
                });
              },
            )
            .catch(reject);
        });
      }
    } catch (error) {
      // A later acquisition can add the device lock to existing session locks.
      // Roll back only locks acquired by this call if any resource is busy.
      acquired.forEach((resource) => {
        this.releases.get(resource)?.();
        this.releases.delete(resource);
      });
      throw error;
    }
  }

  release(): void {
    this.releases.forEach((release) => release());
    this.releases.clear();
  }
}
