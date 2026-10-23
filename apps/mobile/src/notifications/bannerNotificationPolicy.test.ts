import { describe, expect, it } from 'vitest';

import { NotificationCategoryEnum } from '@podverse/helpers';

import {
  bannerKindForNotification,
  bannerNotificationCopy,
  DEFAULT_BANNER_NOTIFICATION_ENABLED,
  resolveBannerNotificationEnabled,
  shouldShowBannerNotification,
} from './bannerNotificationPolicy';

describe('bannerKindForNotification', () => {
  it('treats every new-content notification as New Item, including one with no payload', () => {
    const episode = {
      category: NotificationCategoryEnum.NewContent,
      payload: { type: 'new-episode' },
    };
    const track = {
      category: NotificationCategoryEnum.NewContent,
      payload: { type: 'new-track' },
    };
    const withoutPayload = {
      category: NotificationCategoryEnum.NewContent,
      payload: null,
    };

    expect(bannerKindForNotification(episode)).toBe('new-item');
    expect(bannerKindForNotification(track)).toBe('new-item');
    expect(bannerKindForNotification(withoutPayload)).toBe('new-item');
    expect(shouldShowBannerNotification(episode, DEFAULT_BANNER_NOTIFICATION_ENABLED)).toBe(true);
  });

  it('maps a livestream only when the payload type is started or scheduled', () => {
    const started = {
      category: NotificationCategoryEnum.Livestream,
      payload: { type: 'livestream-started' },
    };
    const scheduled = {
      category: NotificationCategoryEnum.Livestream,
      payload: { type: 'livestream-scheduled' },
    };
    const other = {
      category: NotificationCategoryEnum.Livestream,
      payload: { type: 'other' },
    };
    const missingType = {
      category: NotificationCategoryEnum.Livestream,
      payload: {},
    };
    const withoutPayload = {
      category: NotificationCategoryEnum.Livestream,
      payload: null,
    };

    expect(bannerKindForNotification(started)).toBe('livestream-started');
    expect(bannerKindForNotification(scheduled)).toBe('livestream-scheduled');
    expect(shouldShowBannerNotification(started, DEFAULT_BANNER_NOTIFICATION_ENABLED)).toBe(true);

    expect(bannerKindForNotification(other)).toBeNull();
    expect(bannerKindForNotification(missingType)).toBeNull();
    expect(bannerKindForNotification(withoutPayload)).toBeNull();
    expect(shouldShowBannerNotification(other, DEFAULT_BANNER_NOTIFICATION_ENABLED)).toBe(false);
    expect(shouldShowBannerNotification(missingType, DEFAULT_BANNER_NOTIFICATION_ENABLED)).toBe(
      false
    );
    expect(shouldShowBannerNotification(withoutPayload, DEFAULT_BANNER_NOTIFICATION_ENABLED)).toBe(
      false
    );
  });

  it('reads messageType when type is missing', () => {
    expect(
      bannerKindForNotification({
        category: NotificationCategoryEnum.Livestream,
        payload: { messageType: 'livestream-started' },
      })
    ).toBe('livestream-started');
  });

  it('hides each admin category while its switch is off', () => {
    const adminCategories = [
      { category: NotificationCategoryEnum.ProductUpdate, kind: 'product-update' },
      { category: NotificationCategoryEnum.Maintenance, kind: 'maintenance' },
      { category: NotificationCategoryEnum.TermsOfService, kind: 'terms-of-service' },
      { category: NotificationCategoryEnum.General, kind: 'general' },
    ];

    for (const entry of adminCategories) {
      const notification = { category: entry.category, payload: null };
      expect(bannerKindForNotification(notification)).toBe(entry.kind);
      expect(shouldShowBannerNotification(notification, DEFAULT_BANNER_NOTIFICATION_ENABLED)).toBe(
        false
      );
    }
  });
});

describe('banner notification defaults', () => {
  it('turns on New Item and Livestream Started and leaves the other five off', () => {
    expect(DEFAULT_BANNER_NOTIFICATION_ENABLED).toEqual({
      'new-item': true,
      'livestream-started': true,
      'livestream-scheduled': false,
      'product-update': false,
      maintenance: false,
      'terms-of-service': false,
      general: false,
    });
  });

  it('fills missing keys from the defaults and ignores anything that is not a kind flag', () => {
    expect(resolveBannerNotificationEnabled(null)).toEqual(DEFAULT_BANNER_NOTIFICATION_ENABLED);
    expect(resolveBannerNotificationEnabled(null)).not.toBe(DEFAULT_BANNER_NOTIFICATION_ENABLED);

    const stored = {
      'new-item': false,
      'livestream-scheduled': true,
      extra: true,
    };

    expect(resolveBannerNotificationEnabled(stored)).toEqual({
      ...DEFAULT_BANNER_NOTIFICATION_ENABLED,
      'new-item': false,
      'livestream-scheduled': true,
    });
    expect(DEFAULT_BANNER_NOTIFICATION_ENABLED['new-item']).toBe(true);
    expect(DEFAULT_BANNER_NOTIFICATION_ENABLED['livestream-scheduled']).toBe(false);
  });
});

describe('bannerNotificationCopy', () => {
  it('trims the title and turns an HTML body into one line of plain text', () => {
    expect(
      bannerNotificationCopy({
        title: '  Hello   world  ',
        body: '<p>New <b>episode</b></p>',
      })
    ).toEqual({ title: 'Hello world', body: 'New episode' });
  });

  it('uses the body as the title when the title is empty', () => {
    expect(
      bannerNotificationCopy({
        title: '   ',
        body: '<p>Live now</p>',
      })
    ).toEqual({ title: 'Live now', body: null });
  });

  it('returns null when the title is whitespace and there is no body', () => {
    expect(bannerNotificationCopy({ title: '  \n ', body: null })).toBeNull();
  });

  it('keeps a long body to 140 characters', () => {
    expect(bannerNotificationCopy({ title: 'Title', body: 'a'.repeat(900) })).toEqual({
      title: 'Title',
      body: 'a'.repeat(140),
    });
  });
});
