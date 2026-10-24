import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emitNotificationsReadEvent,
  useNotificationsUnreadCount,
} from '../useNotificationsUnreadCount';

const hoisted = vi.hoisted(() => ({
  reqNotificationsUnreadCount: vi.fn(),
}));

vi.mock('../../factories/apiRequestService', () => ({
  getApiRequestService: () => ({
    reqNotificationsUnreadCount: hoisted.reqNotificationsUnreadCount,
  }),
}));

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('useNotificationsUnreadCount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.reqNotificationsUnreadCount.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  it('fetches on mount and again after 60 seconds while the stream is down', async () => {
    hoisted.reqNotificationsUnreadCount.mockResolvedValue({ unread_count: 4 });

    const { result } = renderHook(() =>
      useNotificationsUnreadCount({ enabled: true, streamOpen: false })
    );
    await settle();

    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(1);
    expect(result.current.unreadCount).toBe(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('stops polling after the stream opens', async () => {
    hoisted.reqNotificationsUnreadCount.mockResolvedValue({ unread_count: 1 });

    const { rerender } = renderHook(
      ({ streamOpen }: { streamOpen: boolean }) =>
        useNotificationsUnreadCount({ enabled: true, streamOpen }),
      { initialProps: { streamOpen: false } }
    );
    await settle();
    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(1);

    rerender({ streamOpen: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('refetches when the tab becomes visible and ignores a hidden change', async () => {
    hoisted.reqNotificationsUnreadCount.mockResolvedValue({ unread_count: 1 });

    renderHook(() => useNotificationsUnreadCount({ enabled: true, streamOpen: false }));
    await settle();
    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('refetches when a read event is emitted', async () => {
    hoisted.reqNotificationsUnreadCount.mockResolvedValue({ unread_count: 1 });

    renderHook(() => useNotificationsUnreadCount({ enabled: true, streamOpen: false }));
    await settle();
    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(1);

    act(() => {
      emitNotificationsReadEvent();
    });
    await settle();

    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('keeps a newer count when an older fetch resolves', async () => {
    let resolveFetch: (value: { unread_count: number }) => void = () => {};
    const pending = new Promise<{ unread_count: number }>((resolve) => {
      resolveFetch = resolve;
    });
    hoisted.reqNotificationsUnreadCount.mockReturnValue(pending);

    const { result } = renderHook(() =>
      useNotificationsUnreadCount({ enabled: true, streamOpen: false })
    );

    act(() => {
      result.current.setUnreadCount(5);
    });
    expect(result.current.unreadCount).toBe(5);

    await act(async () => {
      resolveFetch({ unread_count: 2 });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.unreadCount).toBe(5);
    expect(hoisted.reqNotificationsUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('stays at 0 and does not fetch when disabled', async () => {
    const { result } = renderHook(() =>
      useNotificationsUnreadCount({ enabled: false, streamOpen: false })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(result.current.unreadCount).toBe(0);
    expect(hoisted.reqNotificationsUnreadCount).not.toHaveBeenCalled();
  });
});
