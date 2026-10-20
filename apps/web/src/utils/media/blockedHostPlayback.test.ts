import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./resolveMediaUrl', () => ({
  resolveMediaUrl: vi.fn(),
}));

import {
  clearBlockedHostPlaybackAttempt,
  decideBlockedHostPlayback,
  resolvedPlaybackUrlForIdentity,
} from './blockedHostPlayback';
import { resolveMediaUrl } from './resolveMediaUrl';

const resolveMock = vi.mocked(resolveMediaUrl);
const IDENTITY = 'ep-1';
const MEDIA_URL = 'https://cdn.example/episode.mp3';

const hostBlocked = {
  kind: 'host-blocked' as const,
  mediaUrl: MEDIA_URL,
  identity: IDENTITY,
  credentialsProtected: false,
};

describe('decideBlockedHostPlayback', () => {
  beforeEach(() => {
    clearBlockedHostPlaybackAttempt(IDENTITY);
    resolveMock.mockReset();
  });

  it('reloads a resolved final URL once and remembers it for that item', async () => {
    resolveMock.mockResolvedValue({ url: 'https://cdn.example/final.mp3', reason: 'resolved' });

    await expect(decideBlockedHostPlayback(hostBlocked)).resolves.toEqual({
      type: 'reload',
      url: 'https://cdn.example/final.mp3',
    });
    expect(resolvedPlaybackUrlForIdentity(IDENTITY)).toBe('https://cdn.example/final.mp3');

    await expect(decideBlockedHostPlayback(hostBlocked)).resolves.toEqual({ type: 'pass' });
    expect(resolveMock).toHaveBeenCalledTimes(1);

    clearBlockedHostPlaybackAttempt(IDENTITY);
    expect(resolvedPlaybackUrlForIdentity(IDENTITY)).toBeNull();
  });

  it('shares one resolution when the same item fails twice at once', async () => {
    let finish: (value: { url: string; reason: 'resolved' }) => void = () => undefined;
    resolveMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const first = decideBlockedHostPlayback(hostBlocked);
    const second = decideBlockedHostPlayback(hostBlocked);
    finish({ url: 'https://cdn.example/final.mp3', reason: 'resolved' });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { type: 'reload', url: 'https://cdn.example/final.mp3' },
      { type: 'reload', url: 'https://cdn.example/final.mp3' },
    ]);
    expect(resolveMock).toHaveBeenCalledTimes(1);
  });

  it('leaves a credentials-protected item unchanged', async () => {
    await expect(
      decideBlockedHostPlayback({ ...hostBlocked, credentialsProtected: true })
    ).resolves.toEqual({ type: 'pass' });
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('maps a missing file and an HTTP error onto the playback error', async () => {
    resolveMock.mockResolvedValueOnce({ url: null, reason: 'http_error', httpStatus: 404 });
    await expect(decideBlockedHostPlayback(hostBlocked)).resolves.toEqual({
      type: 'report',
      kind: 'file-not-found',
      detail: 'http_error',
      httpStatus: 404,
    });

    clearBlockedHostPlaybackAttempt(IDENTITY);
    resolveMock.mockResolvedValueOnce({ url: null, reason: 'http_error', httpStatus: 503 });
    await expect(decideBlockedHostPlayback(hostBlocked)).resolves.toEqual({
      type: 'report',
      kind: 'host-http',
      detail: 'http_error',
      httpStatus: 503,
    });
  });

  it('keeps a final host that still blocks websites as host-blocked', async () => {
    resolveMock.mockResolvedValue({ url: null, reason: 'blocked_final' });

    await expect(decideBlockedHostPlayback(hostBlocked)).resolves.toEqual({
      type: 'report',
      kind: 'host-blocked',
      detail: 'blocked_final',
    });
  });
});
