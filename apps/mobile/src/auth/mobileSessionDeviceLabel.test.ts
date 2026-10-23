import { describe, expect, it } from 'vitest';

import { mobileSessionDeviceLabel } from './mobileSessionDeviceLabel';

describe('mobileSessionDeviceLabel', () => {
  it('names an iPhone, an iPad, and any other iOS idiom', () => {
    expect(mobileSessionDeviceLabel({ interfaceIdiom: 'phone', os: 'ios' })).toBe('iPhone · iOS');
    expect(mobileSessionDeviceLabel({ interfaceIdiom: 'pad', os: 'ios' })).toBe('iPad · iOS');
    expect(mobileSessionDeviceLabel({ interfaceIdiom: 'tv', os: 'ios' })).toBe('iOS');
  });

  it('joins an Android model and falls back to the platform when the model is empty', () => {
    expect(
      mobileSessionDeviceLabel({
        manufacturer: 'Google',
        model: 'Pixel 6 Pro',
        os: 'android',
      })
    ).toBe('Google Pixel 6 Pro · Android');
    expect(mobileSessionDeviceLabel({ manufacturer: '', model: '', os: 'android' })).toBe(
      'Android'
    );
  });

  it('returns null for a platform with no brand name to send', () => {
    expect(mobileSessionDeviceLabel({ os: 'other' })).toBeNull();
  });
});
