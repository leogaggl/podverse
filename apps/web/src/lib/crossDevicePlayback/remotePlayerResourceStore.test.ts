import { describe, expect, it, vi } from 'vitest';

import type { DTOPlaybackResourceRef } from '@podverse/helpers';

import type {
  RemotePlayerResource,
  RemotePlayerResourceRequest,
} from './remotePlayerResourceStore';
import {
  createRemotePlayerResourceStore,
  playbackResourceRefKey,
} from './remotePlayerResourceStore';

const ITEM_REF: DTOPlaybackResourceRef = { kind: 'item', item_id_text: 'shared' };
const CLIP_REF: DTOPlaybackResourceRef = { kind: 'clip', clip_id_text: 'shared' };

function resource(idText: string): RemotePlayerResource {
  return {
    kind: 'add_by_rss',
    idText,
    resourceData: { title: idText },
    hashId: idText,
  };
}

function request(ref: DTOPlaybackResourceRef | null, isLive = false): RemotePlayerResourceRequest {
  return { ref, isLive, queueIdTexts: [] };
}

function defer<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolvePromise: ((value: T) => void) | null = null;
  let rejectPromise: ((reason: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  if (resolvePromise === null || rejectPromise === null) {
    throw new Error('Promise executor did not run synchronously');
  }
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe('playbackResourceRefKey', () => {
  it('gives an item and a clip with the same id text different keys', () => {
    expect(playbackResourceRefKey(ITEM_REF)).toBe('item:shared');
    expect(playbackResourceRefKey(CLIP_REF)).toBe('clip:shared');
    expect(playbackResourceRefKey(ITEM_REF)).not.toBe(playbackResourceRefKey(CLIP_REF));
    expect(playbackResourceRefKey({ kind: 'soundbite', item_soundbite_id_text: 'shared' })).toBe(
      'soundbite:shared'
    );
    expect(playbackResourceRefKey({ kind: 'add_by_rss', add_by_rss_hash_id: 'shared' })).toBe(
      'add_by_rss:shared'
    );
  });
});

describe('createRemotePlayerResourceStore', () => {
  it('resolves whenSettled at once when nothing is loading', async () => {
    const store = createRemotePlayerResourceStore({ load: async () => null });
    await expect(store.whenSettled()).resolves.toEqual({ status: 'none', key: null });
  });

  it('loads a new ref once, then ignores the same key', async () => {
    const load = vi.fn(async () => resource('shared'));
    const store = createRemotePlayerResourceStore({ load });

    store.ensure(request(ITEM_REF));
    expect(store.getState()).toEqual({ status: 'loading', key: 'item:shared' });
    store.ensure(request(ITEM_REF, true));
    expect(load).toHaveBeenCalledTimes(1);

    const settled = store.whenSettled();
    expect(store.getState().status).toBe('loading');
    await expect(settled).resolves.toEqual({
      status: 'ready',
      key: 'item:shared',
      resource: resource('shared'),
    });

    store.ensure(request(ITEM_REF));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the newer ref when an older load resolves last', async () => {
    const first = defer<RemotePlayerResource | null>();
    const second = defer<RemotePlayerResource | null>();
    const load = vi
      .fn<() => Promise<RemotePlayerResource | null>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const store = createRemotePlayerResourceStore({ load });

    store.ensure(request(ITEM_REF));
    store.ensure(request(CLIP_REF));
    expect(store.getState()).toEqual({ status: 'loading', key: 'clip:shared' });

    second.resolve(resource('clip'));
    await second.promise;
    await Promise.resolve();
    expect(store.getState()).toEqual({
      status: 'ready',
      key: 'clip:shared',
      resource: resource('clip'),
    });

    first.resolve(resource('item'));
    await first.promise;
    await Promise.resolve();
    expect(store.getState()).toEqual({
      status: 'ready',
      key: 'clip:shared',
      resource: resource('clip'),
    });
  });

  it('records a null result and a rejected load as missing', async () => {
    const empty = createRemotePlayerResourceStore({ load: async () => null });
    empty.ensure(request(ITEM_REF));
    await expect(empty.whenSettled()).resolves.toEqual({ status: 'missing', key: 'item:shared' });

    const rejected = createRemotePlayerResourceStore({
      load: async () => {
        throw new Error('missing item');
      },
    });
    rejected.ensure(request(CLIP_REF));
    await expect(rejected.whenSettled()).resolves.toEqual({
      status: 'missing',
      key: 'clip:shared',
    });
  });

  it('clears to none and drops a load that resolves after the ref is gone', async () => {
    const pending = defer<RemotePlayerResource | null>();
    const store = createRemotePlayerResourceStore({ load: () => pending.promise });

    store.ensure(request(ITEM_REF));
    expect(store.getState().status).toBe('loading');
    store.ensure(request(null));
    expect(store.getState()).toEqual({ status: 'none', key: null });
    await expect(store.whenSettled()).resolves.toEqual({ status: 'none', key: null });

    pending.resolve(resource('late'));
    await pending.promise;
    await Promise.resolve();
    expect(store.getState()).toEqual({ status: 'none', key: null });
  });
});
