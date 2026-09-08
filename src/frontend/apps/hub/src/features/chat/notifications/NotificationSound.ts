/**
 * One audio context per authenticated shell, independent of Notification permission.
 * Keep the file decoded in memory so each receipt can play without loading it.
 * Preloading does not bypass the browser's autoplay restrictions.
 */
export class NotificationSound {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private loading = false;
  private disposed = false;
  private abort = new AbortController();

  /** Listen for audio-unlocking gestures and start preloading the sound. */
  constructor() {
    // Capture gestures even when a component stops the event's propagation.
    window.addEventListener("click", this.unlock, true);
    window.addEventListener("keydown", this.unlock, true);
    this.prepare();
  }

  /** Whether the sound can play now, without waiting for loading or activation. */
  get ready(): boolean {
    return (
      !this.disposed &&
      this.context?.state === "running" &&
      this.buffer !== null
    );
  }

  /** Create the audio context if needed and start loading the reusable buffer. */
  private prepare(): void {
    if (this.disposed || typeof AudioContext === "undefined") return;
    try {
      this.context ??= new AudioContext();
    } catch {
      // Audio support must not interrupt messaging.
      return;
    }
    // Decode ahead of incoming activity, even while autoplay is suspended.
    void this.loadBuffer(this.context);
  }

  /** Fetch and decode the sound file once, retaining it for future playback. */
  private async loadBuffer(context: AudioContext): Promise<void> {
    // Reuse the decoded file and avoid concurrent loads; failed loads can retry.
    if (this.buffer || this.loading) return;
    this.loading = true;
    try {
      const response = await fetch("/assets/notif-placeholder.wav", {
        signal: this.abort.signal,
      });
      if (!response.ok) return;
      const buffer = await context.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (!this.disposed) this.buffer = buffer;
    } catch {
      // A later interaction may retry loading; it never replays missed sounds.
    } finally {
      this.loading = false;
    }
  }

  /** Use a real interaction to resume audio and retry preparation if needed. */
  private unlock = (event: Event) => {
    if (!event.isTrusted || this.disposed) return;
    this.prepare();
    const context = this.context;
    if (!context || context.state === "running" || context.state === "closed")
      return;
    try {
      // Resume inside the user gesture, without waiting for the audio file.
      // Visual notification permission does not grant permission to play audio.
      void context.resume().catch(() => {});
    } catch {
      // Autoplay restrictions must not interrupt messaging.
    }
  };

  /** Play one sound immediately if ready; otherwise discard this playback. */
  play(): void {
    // Drop this receipt if audio is blocked or loading; never wait to play it.
    if (!this.ready || !this.context) return;
    try {
      // Share the buffer, but use a new source so close receipts can overlap.
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.connect(this.context.destination);
      source.onended = () => source.disconnect();
      source.start();
    } catch {
      // Never queue a sound to replay on the next interaction.
    }
  }

  /** Remove listeners, cancel loading and release this session's audio resources. */
  dispose(): void {
    // Also prevent an in-flight decoding result from restoring the buffer.
    this.disposed = true;
    window.removeEventListener("click", this.unlock, true);
    window.removeEventListener("keydown", this.unlock, true);
    this.abort.abort();
    if (this.context) {
      void this.context.close().catch(() => {});
    }
    this.buffer = null;
  }
}
