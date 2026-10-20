import { describe, expect, it } from 'vitest';

import type { WebPlaybackErrorKind } from './playbackErrorCopy';
import {
  mediaErrorKind,
  openablePlaybackMediaUrl,
  playbackErrorMessageKeys,
  playRejectionKind,
  reducePlaybackError,
  resolveReportedPlaybackKind,
  shouldAdvanceQueueAfterEnded,
  WEB_PLAYBACK_ERROR_KINDS,
} from './playbackErrorCopy';

const everyKindIsListed: Exclude<
  WebPlaybackErrorKind,
  (typeof WEB_PLAYBACK_ERROR_KINDS)[number]
> extends never
  ? true
  : never = true;

const errorFor = (identity: string) => ({
  kind: 'network' as const,
  identity,
  mediaUrl: 'https://cdn.example.com/ep.mp3',
  code: 'MEDIA_ERR_NETWORK',
  message: 'failed',
});

describe('playbackErrorMessageKeys', () => {
  it('gives every kind its own body under the shared playback title', () => {
    const bodies = WEB_PLAYBACK_ERROR_KINDS.map((kind) => playbackErrorMessageKeys(kind).bodyKey);
    expect(new Set(bodies).size).toBe(WEB_PLAYBACK_ERROR_KINDS.length);
    expect(everyKindIsListed).toBe(true);
    for (const kind of WEB_PLAYBACK_ERROR_KINDS) {
      const keys = playbackErrorMessageKeys(kind);
      expect(keys.titleKey).toBe('playback_title');
      expect(keys.a11yKey).toBe('playback_a11y');
      expect(keys.bodyKey.startsWith('playback_')).toBe(true);
    }
  });
});

describe('mediaErrorKind', () => {
  it('maps code 4 to host-blocked and ignores an aborted load', () => {
    expect(mediaErrorKind(4)).toBe('host-blocked');
    expect(mediaErrorKind(2)).toBe('network');
    expect(mediaErrorKind(3)).toBe('decode');
    expect(mediaErrorKind(1)).toBeNull();
  });
});

describe('playRejectionKind', () => {
  it('treats an autoplay rejection as no error and a NotSupportedError as host-blocked', () => {
    const named = (name: string) => {
      const error = new Error('play rejected');
      error.name = name;
      return error;
    };
    expect(playRejectionKind(named('NotAllowedError'))).toBeNull();
    expect(playRejectionKind(named('AbortError'))).toBeNull();
    expect(playRejectionKind(named('NotSupportedError'))).toBe('host-blocked');
  });
});

describe('resolveReportedPlaybackKind', () => {
  it('lets a credentials failure replace the media-element kind', () => {
    expect(
      resolveReportedPlaybackKind({
        mediaKind: 'host-blocked',
        credentialsFailure: 'media_needs_credentials',
      })
    ).toBe('credentials-required');
    expect(
      resolveReportedPlaybackKind({
        mediaKind: 'network',
        credentialsFailure: null,
      })
    ).toBe('network');
  });
});

describe('reducePlaybackError', () => {
  it('clears the error when a different item loads and when playback starts', () => {
    const current = errorFor('item-1');
    expect(reducePlaybackError(current, { type: 'identity', identity: 'item-2' })).toBeNull();
    expect(reducePlaybackError(current, { type: 'identity', identity: 'item-1' })).toBe(current);
    expect(reducePlaybackError(current, { type: 'playing' })).toBeNull();
    expect(reducePlaybackError(current, { type: 'retry' })).toBeNull();
  });
});

describe('shouldAdvanceQueueAfterEnded', () => {
  it('does not advance when the media element failed or an error is showing', () => {
    expect(shouldAdvanceQueueAfterEnded({ mediaErrorCode: null, playbackError: null })).toBe(true);
    expect(shouldAdvanceQueueAfterEnded({ mediaErrorCode: 4, playbackError: null })).toBe(false);
    expect(
      shouldAdvanceQueueAfterEnded({ mediaErrorCode: null, playbackError: errorFor('item-1') })
    ).toBe(false);
  });
});

describe('openablePlaybackMediaUrl', () => {
  it('keeps an http(s) address and drops one that carries a username or password', () => {
    expect(openablePlaybackMediaUrl('https://cdn.example.com/ep.mp3')).toBe(
      'https://cdn.example.com/ep.mp3'
    );
    expect(openablePlaybackMediaUrl('https://user:secret@cdn.example.com/ep.mp3')).toBeNull();
    expect(openablePlaybackMediaUrl('blob:https://podverse.fm/abc')).toBeNull();
  });
});
