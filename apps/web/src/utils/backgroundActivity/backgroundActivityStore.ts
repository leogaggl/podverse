/** Each kind of background work the overlay can report. */
export type BackgroundActivityKind = 'add_by_rss_refresh';

export type BackgroundActivityEntry = {
  kind: BackgroundActivityKind;
  /** Counted steps finished since this kind last went idle. */
  completed: number;
  /** Counted steps started since this kind last went idle. */
  total: number;
};

export type BackgroundActivitySnapshot = readonly BackgroundActivityEntry[];

export type BackgroundActivityStepOptions = {
  /**
   * Counted steps add to the entry's `completed of total`; uncounted steps only keep it
   * visible.
   */
  counted: boolean;
};

type KindState = {
  active: number;
  completed: number;
  total: number;
  order: number;
};

const EMPTY_SNAPSHOT: BackgroundActivitySnapshot = Object.freeze([]);
const states = new Map<BackgroundActivityKind, KindState>();
const listeners = new Set<() => void>();
let nextOrder = 0;
/** Cached so a read with no store change returns the same array. */
let snapshot: BackgroundActivitySnapshot = EMPTY_SNAPSHOT;

function publish(): void {
  if (states.size === 0) {
    snapshot = EMPTY_SNAPSHOT;
  } else {
    const entries = [...states.entries()]
      .sort(([, left], [, right]) => left.order - right.order)
      .map(([kind, state]) =>
        Object.freeze({
          kind,
          completed: state.completed,
          total: state.total,
        })
      );
    snapshot = Object.freeze(entries);
  }

  for (const listener of listeners) {
    listener();
  }
}

/**
 * Marks one step of background work as running and returns the function that ends it. The kind
 * stays in the snapshot while any of its steps run; its count starts over once it goes idle.
 */
export function beginBackgroundActivity(
  kind: BackgroundActivityKind,
  options: BackgroundActivityStepOptions
): () => void {
  let state = states.get(kind);
  if (state === undefined) {
    state = { active: 0, completed: 0, total: 0, order: nextOrder };
    nextOrder += 1;
    states.set(kind, state);
  }
  state.active += 1;
  if (options.counted) {
    state.total += 1;
  }
  publish();

  let ended = false;
  return () => {
    if (ended) {
      return;
    }
    ended = true;
    const current = states.get(kind);
    if (current === undefined) {
      return;
    }
    current.active -= 1;
    if (options.counted) {
      current.completed += 1;
    }
    if (current.active === 0) {
      states.delete(kind);
    }
    publish();
  };
}

export async function trackBackgroundActivity<T>(
  kind: BackgroundActivityKind,
  options: BackgroundActivityStepOptions,
  work: () => Promise<T>
): Promise<T> {
  const end = beginBackgroundActivity(kind, options);
  try {
    return await work();
  } finally {
    end();
  }
}

export function subscribeBackgroundActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBackgroundActivitySnapshot(): BackgroundActivitySnapshot {
  return snapshot;
}

/** Empty snapshot for server rendering; background work runs only in the browser. */
export function getServerBackgroundActivitySnapshot(): BackgroundActivitySnapshot {
  return EMPTY_SNAPSHOT;
}
