/**
 * Session-only sleep timer shared by every player settings menu. Choosing a duration pauses
 * playback once after that many minutes. Off cancels. Nothing is stored, and a second menu
 * reads the same choice.
 */
type SleepTimerListener = () => void;

let minutes: number | null = null;
const listeners = new Set<SleepTimerListener>();

export function getSleepTimerMinutes(): number | null {
  return minutes;
}

export function subscribeSleepTimer(listener: SleepTimerListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSleepTimerMinutes(next: number | null): void {
  if (next === minutes) {
    return;
  }
  minutes = next;
  for (const listener of listeners) {
    listener();
  }
}

export function sleepTimerDelayMs(durationMinutes: number): number {
  return durationMinutes * 60 * 1000;
}
