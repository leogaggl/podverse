let checkInHandler: (() => void) | null = null;

/** The provider registers its check-in trigger; returns the unregister function. */
export function registerPlaybackCheckInHandler(handler: () => void): () => void {
  checkInHandler = handler;
  return () => {
    if (checkInHandler === handler) {
      checkInHandler = null;
    }
  };
}

/** Runs the registered check-in now; no-op when none is registered. */
export function requestPlaybackCheckIn(): void {
  checkInHandler?.();
}
