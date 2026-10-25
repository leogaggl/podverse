/**
 * Single-flight gate for auto-queue fills. One fill runs at a time; a second request for the same
 * playing target and buffer generation joins it instead of fetching again. A request for a
 * different target, or one made after `bump`, starts a new fill, and the older fill settles as
 * `stale` so its rows are never written over a newer play. Framework-free so it is unit-tested.
 */
export type AutoQueueFillGateResult<T> = { stale: boolean; value: T };

export type AutoQueueFillGate<T> = {
  /** Current buffer generation. */
  generation: () => number;
  /**
   * The buffer now belongs to a different play (explicit play, playlist play, Shuffle or Repeat
   * toggle, cleared now-playing). A fill in flight settles as stale.
   */
  bump: () => void;
  /**
   * Run `task` for the playing target `key`, or join the fill already running for that key and
   * generation. A rejected task rejects every joined caller and frees the slot.
   */
  run: (key: string, task: () => Promise<T>) => Promise<AutoQueueFillGateResult<T>>;
};

type InFlightFill<T> = {
  fillId: number;
  key: string;
  generation: number;
  settled: Promise<AutoQueueFillGateResult<T>>;
};

export function createAutoQueueFillGate<T>(): AutoQueueFillGate<T> {
  let generation = 0;
  let lastFillId = 0;
  let inFlight: InFlightFill<T> | null = null;

  const run = (key: string, task: () => Promise<T>): Promise<AutoQueueFillGateResult<T>> => {
    if (inFlight !== null && inFlight.key === key && inFlight.generation === generation) {
      return inFlight.settled;
    }

    lastFillId += 1;
    const fillId = lastFillId;
    const startedGeneration = generation;
    const isCurrentFill = (): boolean => inFlight !== null && inFlight.fillId === fillId;
    const releaseSlot = (): void => {
      if (isCurrentFill()) {
        inFlight = null;
      }
    };

    // The async wrapper turns a synchronous throw from `task` into a rejection.
    const started = (async () => task())();
    const settled = started.then(
      (value) => {
        const stale = !isCurrentFill() || generation !== startedGeneration;
        releaseSlot();
        return { stale, value };
      },
      (error: unknown) => {
        releaseSlot();
        throw error;
      }
    );

    inFlight = { fillId, generation: startedGeneration, key, settled };
    return settled;
  };

  return {
    bump: () => {
      generation += 1;
    },
    generation: () => generation,
    run,
  };
}
