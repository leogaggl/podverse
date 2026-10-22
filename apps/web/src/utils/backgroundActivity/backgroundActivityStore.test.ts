import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A fresh module per test, so activity state does not leak between cases. */
const loadStore = async () => import('./backgroundActivityStore');

describe('backgroundActivityStore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('starts empty and matches the server snapshot', async () => {
    const { getBackgroundActivitySnapshot, getServerBackgroundActivitySnapshot } =
      await loadStore();
    const server = getServerBackgroundActivitySnapshot();
    expect(server).toEqual([]);
    expect(getBackgroundActivitySnapshot()).toBe(server);
    expect(getServerBackgroundActivitySnapshot()).toBe(server);
  });

  it('shows one counted step until it ends', async () => {
    const { beginBackgroundActivity, getBackgroundActivitySnapshot } = await loadStore();
    const end = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    expect(getBackgroundActivitySnapshot()).toEqual([
      { kind: 'add_by_rss_refresh', completed: 0, total: 1 },
    ]);
    end();
    expect(getBackgroundActivitySnapshot()).toEqual([]);
  });

  it('counts only counted steps and keeps the entry while any step runs', async () => {
    const { beginBackgroundActivity, getBackgroundActivitySnapshot } = await loadStore();
    const endCountedA = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    const endCountedB = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    const endUncounted = beginBackgroundActivity('add_by_rss_refresh', { counted: false });
    expect(getBackgroundActivitySnapshot()).toEqual([
      { kind: 'add_by_rss_refresh', completed: 0, total: 2 },
    ]);

    endCountedA();
    expect(getBackgroundActivitySnapshot()).toEqual([
      { kind: 'add_by_rss_refresh', completed: 1, total: 2 },
    ]);

    endUncounted();
    expect(getBackgroundActivitySnapshot()).toEqual([
      { kind: 'add_by_rss_refresh', completed: 1, total: 2 },
    ]);

    endCountedB();
    expect(getBackgroundActivitySnapshot()).toEqual([]);
  });

  it('counts an end call once', async () => {
    const { beginBackgroundActivity, getBackgroundActivitySnapshot } = await loadStore();
    const endCounted = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    const endOther = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    endCounted();
    endCounted();
    expect(getBackgroundActivitySnapshot()).toEqual([
      { kind: 'add_by_rss_refresh', completed: 1, total: 2 },
    ]);
    endOther();
  });

  it('starts the count over after the kind goes idle', async () => {
    const { beginBackgroundActivity, getBackgroundActivitySnapshot } = await loadStore();
    const end = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    end();
    const next = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    expect(getBackgroundActivitySnapshot()).toEqual([
      { kind: 'add_by_rss_refresh', completed: 0, total: 1 },
    ]);
    next();
  });

  it('notifies a listener on begin and end, and not after unsubscribe', async () => {
    const { beginBackgroundActivity, subscribeBackgroundActivity } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = subscribeBackgroundActivity(listener);
    const end = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    expect(listener).toHaveBeenCalledTimes(1);
    end();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    const endAgain = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    endAgain();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('returns the same array until the store changes', async () => {
    const { beginBackgroundActivity, getBackgroundActivitySnapshot } = await loadStore();
    const idle = getBackgroundActivitySnapshot();
    expect(getBackgroundActivitySnapshot()).toBe(idle);

    const end = beginBackgroundActivity('add_by_rss_refresh', { counted: true });
    const running = getBackgroundActivitySnapshot();
    expect(running).not.toBe(idle);
    expect(getBackgroundActivitySnapshot()).toBe(running);
    end();
  });

  it('ends the step and rethrows when work rejects', async () => {
    const { getBackgroundActivitySnapshot, trackBackgroundActivity } = await loadStore();
    const error = new Error('refresh failed');
    await expect(
      trackBackgroundActivity('add_by_rss_refresh', { counted: true }, async () => {
        throw error;
      })
    ).rejects.toBe(error);
    expect(getBackgroundActivitySnapshot()).toEqual([]);
  });
});
