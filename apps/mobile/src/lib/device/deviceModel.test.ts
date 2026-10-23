import { describe, expect, it } from 'vitest';

import { joinDeviceModel } from './deviceModel';

describe('joinDeviceModel', () => {
  it('does not repeat the manufacturer when the model already starts with it', () => {
    expect(joinDeviceModel('Google', 'Pixel 6 Pro')).toBe('Google Pixel 6 Pro');
    expect(joinDeviceModel('samsung', 'samsung SM-G991B')).toBe('samsung SM-G991B');
    expect(joinDeviceModel('', '')).toBeNull();
  });
});
