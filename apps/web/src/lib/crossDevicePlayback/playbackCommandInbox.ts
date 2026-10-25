const DEFAULT_PLAYBACK_COMMAND_INBOX_CAPACITY = 200;

/**
 * Remembers command ids this tab has already seen. A repeat is ignored. Past capacity, the oldest
 * id is forgotten and can be accepted again.
 */
export function createPlaybackCommandInbox(options?: { capacity?: number }): {
  /** True the first time `commandIdText` is seen; false for a repeat. Evicts the oldest past capacity (default 200). */
  accept(commandIdText: string): boolean;
} {
  const capacity = options?.capacity ?? DEFAULT_PLAYBACK_COMMAND_INBOX_CAPACITY;
  const seen = new Set<string>();

  return {
    accept(commandIdText: string): boolean {
      if (seen.has(commandIdText)) {
        return false;
      }
      seen.add(commandIdText);
      if (seen.size > capacity) {
        const oldest = seen.values().next().value;
        if (oldest !== undefined) {
          seen.delete(oldest);
        }
      }
      return true;
    },
  };
}
