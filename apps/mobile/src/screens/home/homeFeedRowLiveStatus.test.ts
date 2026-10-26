import { describe, expect, it } from 'vitest';

import { LiveItemStatusEnum } from '@podverse/helpers';

import { isShareOnlyLivestreamRow, resolveItemRowLiveStatus } from './homeFeedRowLiveStatus';

describe('resolveItemRowLiveStatus', () => {
  it('gives a channel row no status, even while live or scheduled', () => {
    expect(resolveItemRowLiveStatus(true, true, LiveItemStatusEnum.Live)).toBeNull();
    expect(resolveItemRowLiveStatus(true, false, LiveItemStatusEnum.Pending)).toBeNull();
    expect(resolveItemRowLiveStatus(true, true, LiveItemStatusEnum.Pending)).toBeNull();
  });

  it('gives a live item row the danger Live badge with the home-feed-row-live prefix', () => {
    expect(resolveItemRowLiveStatus(false, true, LiveItemStatusEnum.Live)).toEqual({
      labelKey: 'media.livestream.live',
      testIDPrefix: 'home-feed-row-live',
      tone: 'danger',
    });
    expect(resolveItemRowLiveStatus(false, true, undefined)).toEqual({
      labelKey: 'media.livestream.live',
      testIDPrefix: 'home-feed-row-live',
      tone: 'danger',
    });
  });

  it('gives a scheduled item row the neutral Scheduled badge and an ended row the neutral Ended badge', () => {
    expect(resolveItemRowLiveStatus(false, false, LiveItemStatusEnum.Pending)).toEqual({
      labelKey: 'media.livestream.pending',
      testIDPrefix: 'home-feed-row-live-status',
      tone: 'neutral',
    });
    expect(resolveItemRowLiveStatus(false, false, LiveItemStatusEnum.Ended)).toEqual({
      labelKey: 'media.livestream.ended',
      testIDPrefix: 'home-feed-row-live-status',
      tone: 'neutral',
    });
  });

  it('lets an ended status win over live metadata', () => {
    expect(resolveItemRowLiveStatus(false, true, LiveItemStatusEnum.Ended)).toEqual({
      labelKey: 'media.livestream.ended',
      testIDPrefix: 'home-feed-row-live-status',
      tone: 'neutral',
    });
  });

  it('gives a row with no status and no live metadata none', () => {
    expect(resolveItemRowLiveStatus(false, false, undefined)).toBeNull();
    expect(resolveItemRowLiveStatus(false, false, null)).toBeNull();
  });
});

describe('isShareOnlyLivestreamRow', () => {
  it('is true for livestreams, and for any other media type when liveStatusId is set, including null', () => {
    expect(isShareOnlyLivestreamRow('livestreams', undefined)).toBe(true);
    expect(isShareOnlyLivestreamRow('episodes', LiveItemStatusEnum.Live)).toBe(true);
    expect(isShareOnlyLivestreamRow('tracks', null)).toBe(true);
  });

  it('is false for an episode or track row whose liveStatusId is undefined', () => {
    expect(isShareOnlyLivestreamRow('episodes', undefined)).toBe(false);
    expect(isShareOnlyLivestreamRow('tracks', undefined)).toBe(false);
  });
});
