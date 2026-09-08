// This marker suppresses automatic requests, never the fallback on a real gesture.
const AUTOMATIC_ATTEMPT_KEY = "hub:notifications:permission-requested:v1";

export class NotificationPermission {
  private pending = false;
  private requesting = false;
  private automaticAttempted = false;
  private gestureAttempted = false;
  private disposed = false;

  constructor() {
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("click", this.onGesture);
    window.addEventListener("keydown", this.onGesture);
  }

  /** Incoming activity arms the request, including while Hub is in the background. */
  request(): void {
    if (this.disposed || !("Notification" in window)) return;
    this.pending = Notification.permission === "default";
    void this.attempt(false);
  }

  private onFocus = () => {
    void this.attempt(false);
  };

  private onGesture = (event: Event) => {
    if (event.isTrusted) void this.attempt(true);
  };

  private canAttempt(fromGesture: boolean): boolean {
    if (
      this.disposed ||
      this.requesting ||
      !this.pending ||
      this.gestureAttempted ||
      !window.isSecureContext ||
      document.visibilityState !== "visible" ||
      !document.hasFocus() ||
      !("Notification" in window) ||
      Notification.permission !== "default"
    )
      return false;

    if (fromGesture) return navigator.userActivation?.isActive === true;
    return !this.hasAutomaticAttempt();
  }

  private hasAutomaticAttempt(): boolean {
    if (this.automaticAttempted) return true;
    try {
      return Boolean(localStorage.getItem(AUTOMATIC_ATTEMPT_KEY));
    } catch {
      // Unavailable storage does not prevent the first automatic attempt.
      return false;
    }
  }

  private recordAttempt(fromGesture: boolean): void {
    this.automaticAttempted = true;
    if (fromGesture) this.gestureAttempted = true;
    try {
      localStorage.setItem(AUTOMATIC_ATTEMPT_KEY, "true");
    } catch {
      // The in-memory guards remain effective without persistent storage.
    }
  }

  private async attempt(fromGesture: boolean): Promise<void> {
    if (!this.canAttempt(fromGesture)) return;
    this.requesting = true;
    this.recordAttempt(fromGesture);

    try {
      const permission = await Notification.requestPermission();
      if (this.disposed) return;
      this.pending = permission === "default";
      // A blocked automatic request leaves the gesture fallback armed.
      // A dismissed gesture request is not repeated during this page visit.
    } catch {
      // Keep the gesture fallback armed if the automatic request was rejected.
      // Permission errors must never prevent the independent notification sound.
    } finally {
      this.requesting = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.pending = false;
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("click", this.onGesture);
    window.removeEventListener("keydown", this.onGesture);
  }
}
