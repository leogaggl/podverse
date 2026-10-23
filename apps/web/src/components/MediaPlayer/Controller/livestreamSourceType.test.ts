import { describe, expect, it } from 'vitest';

import { HLS_PLAYLIST_MIME_TYPE } from '@podverse/helpers';

import { resolveLivestreamSourceType } from './livestreamSourceType';

describe('resolveLivestreamSourceType', () => {
  it('keeps an explicit enclosure type', () => {
    expect(resolveLivestreamSourceType('https://x/live.m3u8', 'video/mp4')).toBe('video/mp4');
  });

  it('infers an HLS playlist type for a query-string URI when the enclosure type is missing', () => {
    expect(resolveLivestreamSourceType('https://x/live.m3u8?token=1', '')).toBe(
      HLS_PLAYLIST_MIME_TYPE
    );
    expect(resolveLivestreamSourceType('https://x/live.m3u8?token=1', null)).toBe(
      HLS_PLAYLIST_MIME_TYPE
    );
  });

  it('uses an HLS content type when the enclosure type is blank', () => {
    expect(
      resolveLivestreamSourceType('https://x/live', '  ', 'application/vnd.apple.mpegURL')
    ).toBe('application/vnd.apple.mpegURL');
  });

  it('leaves a progressive file with no type unresolved', () => {
    expect(resolveLivestreamSourceType('https://x/ep.mp3?playlist=a.m3u8', null)).toBe(null);
  });
});
