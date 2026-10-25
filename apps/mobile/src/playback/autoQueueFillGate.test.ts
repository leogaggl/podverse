import { describe, expect, it, vi } from 'vitest';

import { createAutoQueueFillGate } from './autoQueueFillGate';

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolvePromise: ((value: T) => void) | null = null;
  let rejectPromise: ((reason: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  if (resolvePromise === null || rejectPromise === null) {
    throw new Error('deferred promise was not initialized');
  }
  return { promise, reject: rejectPromise, resolve: resolvePromise };
};

describe('createAutoQueueFillGate', () => {
  it('joins a second run for the same key instead of starting another task', async () => {
    const gate = createAutoQueueFillGate<string>();
    const fill = deferred<string>();
    const firstTask = vi.fn(() => fill.promise);
    const secondTask = vi.fn(() => Promise.resolve('second'));

    const first = gate.run('item-a', firstTask);
    const second = gate.run('item-a', secondTask);
    fill.resolve('rows');

    await expect(first).resolves.toEqual({ stale: false, value: 'rows' });
    await expect(second).resolves.toEqual({ stale: false, value: 'rows' });
    expect(firstTask).toHaveBeenCalledTimes(1);
    expect(secondTask).not.toHaveBeenCalled();
  });

  it('starts a new task for a different key and settles the older one as stale', async () => {
    const gate = createAutoQueueFillGate<string>();
    const olderFill = deferred<string>();
    const newerTask = vi.fn(() => Promise.resolve('newer rows'));

    const older = gate.run('item-a', () => olderFill.promise);
    const newer = gate.run('item-b', newerTask);
    olderFill.resolve('older rows');

    await expect(older).resolves.toEqual({ stale: true, value: 'older rows' });
    await expect(newer).resolves.toEqual({ stale: false, value: 'newer rows' });
    expect(newerTask).toHaveBeenCalledTimes(1);
  });

  it('marks the in-flight fill stale after a bump and starts a new run for the key', async () => {
    const gate = createAutoQueueFillGate<string>();
    const olderFill = deferred<string>();
    const newerTask = vi.fn(() => Promise.resolve('reloaded rows'));

    const older = gate.run('item-a', () => olderFill.promise);
    gate.bump();
    expect(gate.generation()).toBe(1);
    const newer = gate.run('item-a', newerTask);
    olderFill.resolve('older rows');

    await expect(older).resolves.toEqual({ stale: true, value: 'older rows' });
    await expect(newer).resolves.toEqual({ stale: false, value: 'reloaded rows' });
    expect(newerTask).toHaveBeenCalledTimes(1);
  });

  it('rejects every joined caller and frees the slot when the task fails', async () => {
    const gate = createAutoQueueFillGate<string>();
    const fill = deferred<string>();
    const failure = new Error('network down');

    const first = gate.run('item-a', () => fill.promise);
    const joined = gate.run('item-a', () => Promise.resolve('unused'));
    fill.reject(failure);

    await expect(first).rejects.toBe(failure);
    await expect(joined).rejects.toBe(failure);

    const retryTask = vi.fn(() => Promise.resolve('retried rows'));
    await expect(gate.run('item-a', retryTask)).resolves.toEqual({
      stale: false,
      value: 'retried rows',
    });
    expect(retryTask).toHaveBeenCalledTimes(1);
  });
});
