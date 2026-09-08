/** One audio context per authenticated shell, independent of Notification permission. */
export class NotificationSound {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private loading = false;
  private disposed = false;
  private abort = new AbortController();

  constructor() {
    window.addEventListener("click", this.unlock);
    window.addEventListener("keydown", this.unlock);
  }

  get ready(): boolean {
    return (
      !this.disposed &&
      this.context?.state === "running" &&
      this.buffer !== null
    );
  }

  private unlock = (event: Event) => {
    if (
      !event.isTrusted ||
      this.disposed ||
      typeof AudioContext === "undefined"
    )
      return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
      }
      // Call resume directly inside the user gesture, before fetching/decoding.
      if (this.context.state !== "running" && this.context.state !== "closed") {
        void this.context.resume().catch(() => {});
      }
      if (!this.buffer && !this.loading) {
        this.loading = true;
        const context = this.context;
        void fetch("/assets/notif-placeholder.wav", {
          signal: this.abort.signal,
        })
          .then((response) => {
            if (!response.ok) throw new Error("Notification sound unavailable");
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .then((buffer) => {
            if (!this.disposed) {
              this.buffer = buffer;
            }
          })
          .catch(() => {})
          .finally(() => {
            this.loading = false;
          });
      }
    } catch {
      // Audio support and autoplay restrictions must not interrupt messaging.
    }
  };

  play(): void {
    if (!this.ready || !this.context) return;
    try {
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.connect(this.context.destination);
      source.onended = () => source.disconnect();
      source.start();
    } catch {
      // Never queue a sound to replay on the next interaction.
    }
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("click", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    this.abort.abort();
    if (this.context) {
      void this.context.close().catch(() => {});
    }
    this.buffer = null;
  }
}
