type Job = {
  key: string;
  account: string;
  activity: number;
  added: number;
  due: number;
  run: () => Promise<void>;
};

/** One pool for all connected accounts, independent of modal lifetime. */
class MemberAcquisitionCoordinator {
  private queued = new Map<string, Job>();
  private running = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private lastAccount?: string;

  enqueue(job: Omit<Job, "added">): void {
    if (this.queued.has(job.key) || this.running.has(job.key)) return;
    this.queued.set(job.key, { ...job, added: Date.now() });
    this.schedule();
  }

  cancel(account: string): void {
    for (const [key, job] of this.queued) {
      if (job.account === account) this.queued.delete(key);
    }
    this.schedule();
  }

  private compareJobs(a: Job, b: Job, now: number): number {
    // Après une minute, le plus ancien passe devant, même entre comptes.
    const agedA = now - a.added >= 60_000;
    const agedB = now - b.added >= 60_000;
    if (agedA && agedB) return a.added - b.added;
    if (agedA) return -1;
    if (agedB) return 1;
    const accountOrder =
      Number(a.account === this.lastAccount) -
      Number(b.account === this.lastAccount);
    return accountOrder || b.activity - a.activity || a.added - b.added;
  }

  private schedule = (): void => {
    clearTimeout(this.timer);
    const now = Date.now();
    while (this.running.size < 4) {
      // Un seul parcours suffit à choisir le prochain travail, sans trier la file.
      let job: Job | undefined;
      for (const candidate of this.queued.values()) {
        if (candidate.due > now) continue;
        if (!job || this.compareJobs(candidate, job, now) < 0) job = candidate;
      }
      if (!job) break;
      this.queued.delete(job.key);
      this.running.add(job.key);
      this.lastAccount = job.account;
      // Run in a microtask so all eligibility checks happen at dispatch.
      void Promise.resolve()
        .then(job.run)
        .catch(() => {
          // Owners expose failures. A faulty owner must not strand a slot.
        })
        .finally(() => {
          this.running.delete(job.key);
          this.schedule();
        });
    }
    if (this.queued.size && this.running.size < 4) {
      let due = Infinity;
      for (const job of this.queued.values()) due = Math.min(due, job.due);
      this.timer = setTimeout(this.schedule, Math.max(1, due - Date.now()));
    }
  };
}

export const memberAcquisitions = new MemberAcquisitionCoordinator();
